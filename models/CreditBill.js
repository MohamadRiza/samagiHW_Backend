const db = require('../config/database');

// Initialize credit bills tables
const initCreditBillsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_mobile TEXT NOT NULL,
      total_amount REAL NOT NULL,
      total_discount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      outstanding_amount REAL NOT NULL,
      due_date DATE,
      status TEXT CHECK(status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
      notes TEXT,
      cashier_id INTEGER,
      cashier_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS credit_bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      discount_lkr REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES credit_bills(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_credit_bills_number ON credit_bills(bill_number);
    CREATE INDEX IF NOT EXISTS idx_credit_bills_customer ON credit_bills(customer_id);
    CREATE INDEX IF NOT EXISTS idx_credit_bills_status ON credit_bills(status);
    CREATE INDEX IF NOT EXISTS idx_credit_bills_date ON credit_bills(created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_bills_due ON credit_bills(due_date);
  `);
};

// Generate bill number: CR-YYYYMMDD-XXXX
const generateBillNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `CR-${dateStr}-${random}`;
};

const CreditBill = {
  init: initCreditBillsTable,
  
  // Create credit bill with atomic transaction
  create: (billData, cashier) => {
    const transaction = db.transaction(() => {
      const billNumber = generateBillNumber();
      const dueDate = billData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      
      let totalAmount = 0;
      let totalDiscount = 0;
      
      // Validate stock & calculate totals
      for (const item of billData.items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
        if (!product) throw new Error(`Product ${item.product_name} not found`);
        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.product_name}. Available: ${product.stock_quantity}`);
        }
        totalAmount += item.unit_price * item.quantity;
        totalDiscount += (item.discount_lkr || 0) * item.quantity;
      }
      
      const grandTotal = totalAmount - totalDiscount;
      if (grandTotal < 0) throw new Error('Invalid bill: Negative total');
      
      // Insert credit bill
      const billStmt = db.prepare(`
        INSERT INTO credit_bills (
          bill_number, customer_id, customer_name, customer_mobile,
          total_amount, total_discount, grand_total, outstanding_amount,
          due_date, status, notes, cashier_id, cashier_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `);
      
      const billResult = billStmt.run(
        billNumber,
        billData.customer_id,
        billData.customer_name,
        billData.customer_mobile,
        totalAmount,
        totalDiscount,
        grandTotal,
        grandTotal,
        dueDate,
        billData.notes || null,
        cashier.id,
        cashier.full_name || cashier.username
      );
      
      const billId = billResult.lastInsertRowid;
      
      // Insert bill items & deduct stock
      const itemStmt = db.prepare(`
        INSERT INTO credit_bill_items (bill_id, product_id, product_name, barcode, unit_price, quantity, discount_lkr, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const stockStmt = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      
      for (const item of billData.items) {
        const discountLkr = item.discount_lkr || 0;
        const subtotal = (item.unit_price * item.quantity) - (discountLkr * item.quantity);
        itemStmt.run(billId, item.product_id, item.product_name, item.barcode, item.unit_price, item.quantity, discountLkr, subtotal);
        stockStmt.run(item.quantity, item.product_id);
      }
      
      // Update customer outstanding balance
      db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(grandTotal, billData.customer_id);
      
      return { billId, billNumber, grandTotal, totalDiscount };
    });
    
    return transaction();
  },
  
  // Get recent credit bills
  getRecent: (limit = 50) => {
    return db.prepare(`
      SELECT cb.*, COUNT(cbi.id) as item_count 
      FROM credit_bills cb 
      LEFT JOIN credit_bill_items cbi ON cb.id = cbi.bill_id 
      GROUP BY cb.id 
      ORDER BY cb.created_at DESC 
      LIMIT ?
    `).all(limit);
  },
  
  // Get single bill with items
  getById: (id) => {
    const bill = db.prepare('SELECT * FROM credit_bills WHERE id = ?').get(id);
    if (!bill) return null;
    const items = db.prepare('SELECT * FROM credit_bill_items WHERE bill_id = ?').all(id);
    return { ...bill, items };
  },
  
  // Get bills by customer
  getByCustomer: (customerId) => {
    return db.prepare(`
      SELECT * FROM credit_bills 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `).all(customerId);
  },
  
  // Get outstanding bills (not fully paid)
  getOutstanding: () => {
    return db.prepare(`
      SELECT cb.*, c.name as customer_name, c.company_name, c.mobile
      FROM credit_bills cb 
      LEFT JOIN customers c ON cb.customer_id = c.id
      WHERE cb.status != 'paid' AND cb.outstanding_amount > 0
      ORDER BY cb.due_date ASC
    `).all();
  },
  
  // ✅ FIXED: Get pending bills with filters and sorting
  getPending: (filters = {}) => {
    let query = `
      SELECT cb.*, c.name as customer_name, c.company_name, c.mobile, c.address, c.city
      FROM credit_bills cb
      LEFT JOIN customers c ON cb.customer_id = c.id
      WHERE cb.status != 'paid' AND cb.outstanding_amount > 0
    `;
    
    const params = [];
    
    // Filter by customer details
    if (filters.search) {
      const term = `%${filters.search}%`;
      query += ` AND (c.name LIKE ? OR c.company_name LIKE ? OR c.mobile LIKE ? OR c.address LIKE ? OR c.city LIKE ?)`;
      params.push(term, term, term, term, term);
    }
    
    if (filters.customerId) {
      query += ` AND cb.customer_id = ?`;
      params.push(filters.customerId);
    }
    
    // ✅ FIX: Only apply status filter if it's a valid value (not 'all')
    if (filters.status && ['pending', 'partial'].includes(filters.status)) {
      query += ` AND cb.status = ?`;
      params.push(filters.status);
    }
    // If status is 'all' or null/undefined, skip the filter - shows both pending + partial
    
    // Sorting
    const sortBy = filters.sortBy || 'due_date';
    const order = filters.order || 'ASC';
    const validSorts = ['created_at', 'due_date', 'grand_total', 'outstanding_amount', 'customer_name'];
    const safeSort = validSorts.includes(sortBy) ? sortBy : 'due_date';
    const safeOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${safeSort} ${safeOrder}`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }
    
    return db.prepare(query).all(...params);
  },
  
  // ✅ Update bill payment (full or partial)
  updatePayment: (billId, paymentData) => {
    const transaction = db.transaction(() => {
      const bill = db.prepare('SELECT * FROM credit_bills WHERE id = ?').get(billId);
      if (!bill) throw new Error('Bill not found');
      
      const paidAmount = parseFloat(paymentData.paid_amount) || 0;
      if (paidAmount <= 0) throw new Error('Payment amount must be greater than 0');
      if (paidAmount > bill.outstanding_amount + 0.01) {
        throw new Error(`Payment amount cannot exceed outstanding: LKR ${bill.outstanding_amount.toFixed(2)}`);
      }
      
      const newPaidAmount = bill.paid_amount + paidAmount;
      const newOutstanding = Math.max(0, bill.grand_total - newPaidAmount);
      
      // Determine new status
      let newStatus = bill.status;
      if (newOutstanding <= 0.01) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }
      
      // Update bill
      const billUpdate = db.prepare(`
        UPDATE credit_bills SET
          paid_amount = ?,
          outstanding_amount = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaidAmount, newOutstanding, newStatus, billId);
      
      // Update customer outstanding balance
      const customerUpdate = db.prepare(`
        UPDATE customers SET
          outstanding_balance = outstanding_balance - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(paidAmount, bill.customer_id);
      
      if (billUpdate.changes === 0 || customerUpdate.changes === 0) {
        throw new Error('Failed to update payment');
      }
      
      return {
        success: true,
        billId,
        newOutstanding,
        newStatus,
        paidAmount
      };
    });
    
    return transaction();
  },
  
  // ✅ Get single bill with items for receipt reprint
  getBillWithItems: (billId) => {
    const bill = db.prepare(`
      SELECT cb.*, c.name as customer_name, c.company_name, c.mobile, c.address, c.city, c.email, c.nic_id
      FROM credit_bills cb
      LEFT JOIN customers c ON cb.customer_id = c.id
      WHERE cb.id = ?
    `).get(billId);
    
    if (!bill) return null;
    
    const items = db.prepare('SELECT * FROM credit_bill_items WHERE bill_id = ?').all(billId);
    return { ...bill, items };
  }
};

module.exports = CreditBill;
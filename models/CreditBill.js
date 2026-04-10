const db = require('../config/database');
const Product = require('./Product');

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
  
  // Create credit bill with transaction
  create: (billData, cashier) => {
    const transaction = db.transaction(() => {
      const billNumber = generateBillNumber();
      const dueDate = billData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // Default 30 days
      
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
        totalDiscount += item.discount_lkr * item.quantity;
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
        grandTotal, // Initially full amount is outstanding
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
        const subtotal = (item.unit_price * item.quantity) - (item.discount_lkr * item.quantity);
        itemStmt.run(billId, item.product_id, item.product_name, item.barcode, item.unit_price, item.quantity, item.discount_lkr, subtotal);
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
      SELECT cb.*, c.company_name,
             COUNT(cbi.id) as item_count 
      FROM credit_bills cb 
      LEFT JOIN customers c ON cb.customer_id = c.id
      LEFT JOIN credit_bill_items cbi ON cb.id = cbi.bill_id 
      GROUP BY cb.id 
      ORDER BY cb.created_at DESC 
      LIMIT ?
    `).all(limit);
  },
  
  // Get single bill with items
  getById: (id) => {
    const bill = db.prepare(`
      SELECT cb.*, c.company_name, c.address, c.city, c.email, c.nic_id
      FROM credit_bills cb 
      LEFT JOIN customers c ON cb.customer_id = c.id
      WHERE cb.id = ?
    `).get(id);
    
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
  
  // Get outstanding bills
  getOutstanding: () => {
    return db.prepare(`
      SELECT cb.*, c.name as customer_name, c.company_name, c.mobile
      FROM credit_bills cb 
      LEFT JOIN customers c ON cb.customer_id = c.id
      WHERE cb.status != 'paid' AND cb.outstanding_amount > 0
      ORDER BY cb.due_date ASC
    `).all();
  },
  
  // Update bill payment
  updatePayment: (billId, paidAmount) => {
    const transaction = db.transaction(() => {
      const bill = db.prepare('SELECT * FROM credit_bills WHERE id = ?').get(billId);
      if (!bill) throw new Error('Bill not found');
      
      const newPaidAmount = bill.paid_amount + paidAmount;
      const newOutstanding = bill.grand_total - newPaidAmount;
      
      let status = 'pending';
      if (newOutstanding <= 0) {
        status = 'paid';
      } else if (newPaidAmount > 0) {
        status = 'partial';
      }
      
      // Update bill
      db.prepare(`
        UPDATE credit_bills SET
          paid_amount = ?,
          outstanding_amount = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newPaidAmount, Math.max(0, newOutstanding), status, billId);
      
      // Update customer outstanding
      db.prepare(`
        UPDATE customers SET
          outstanding_balance = outstanding_balance - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(paidAmount, bill.customer_id);
      
      return { success: true, newOutstanding, status };
    });
    
    return transaction();
  }
};

module.exports = CreditBill;
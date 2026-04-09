const db = require('../config/database');

// Initialize tables
const initBillsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT UNIQUE NOT NULL,
    total_amount REAL NOT NULL,
    total_discount REAL DEFAULT 0,
    grand_total REAL NOT NULL,
    payment_method TEXT CHECK(payment_method IN ('CASH', 'CARD')) DEFAULT 'CASH',
    cashier_id INTEGER,
    cashier_name TEXT,
    status TEXT DEFAULT 'COMPLETED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cashier_id) REFERENCES users(id)
  );
    
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      discount_lkr REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(bill_number);
    CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(created_at);
    CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
  `);
};

// Generate readable bill number: BILL-YYYYMMDD-XXXX
const generateBillNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `BILL-${dateStr}-${random}`;
};

const Bill = {
  init: initBillsTable,
  
  // Create bill with atomic transaction (stock deduction + bill save)
  create: (billData, cashier) => {
    const transaction = db.transaction(() => {
      const billNumber = generateBillNumber();
      let totalAmount = 0;
      let totalDiscount = 0;
      
      // 1. Validate stock & calculate totals
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
      
      // 2. Insert bill
      const billStmt = db.prepare(`
        INSERT INTO bills (bill_number, total_amount, total_discount, grand_total, payment_method, cashier_id, cashier_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const billResult = billStmt.run(billNumber, totalAmount, totalDiscount, grandTotal, billData.paymentMethod || 'CASH', cashier.id, cashier.full_name || cashier.username);
      const billId = billResult.lastInsertRowid;
      
      // 3. Insert bill items & deduct stock
      const itemStmt = db.prepare(`
        INSERT INTO bill_items (bill_id, product_id, product_name, barcode, unit_price, quantity, discount_lkr, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const stockStmt = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      
      for (const item of billData.items) {
        const subtotal = (item.unit_price * item.quantity) - (item.discount_lkr * item.quantity);
        itemStmt.run(billId, item.product_id, item.product_name, item.barcode, item.unit_price, item.quantity, item.discount_lkr, subtotal);
        stockStmt.run(item.quantity, item.product_id);
      }
      
      return { billId, billNumber, grandTotal, totalDiscount };
    });
    
    return transaction();
  },
  
  // Get recent bills
  getRecent: (limit = 50) => {
    return db.prepare(`
      SELECT b.*, COUNT(bi.id) as item_count 
      FROM bills b 
      LEFT JOIN bill_items bi ON b.id = bi.bill_id 
      WHERE b.status = 'COMPLETED' 
      GROUP BY b.id 
      ORDER BY b.created_at DESC 
      LIMIT ?
    `).all(limit);
  },
  
  // Get single bill with items
  getById: (id) => {
    const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
    if (!bill) return null;
    
    const items = db.prepare('SELECT * FROM bill_items WHERE bill_id = ?').all(id);
    return { ...bill, items };
  }
};

module.exports = Bill;
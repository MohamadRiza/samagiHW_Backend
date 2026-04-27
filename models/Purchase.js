const db = require('../config/database');
const path = require('path');
const fs = require('fs');

const initPurchasesTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      bill_type TEXT CHECK(bill_type IN ('credit', 'cash')) NOT NULL,
      bill_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      outstanding_amount REAL NOT NULL,
      bill_file_path TEXT,
      bill_file_name TEXT,
      purchase_date DATE NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      notes TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_purchases_type ON purchases(bill_type);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_outstanding ON purchases(outstanding_amount);
  `);
};

const Purchase = {
  init: initPurchasesTable,
  
  // Create purchase
  create: (purchaseData, userId) => {
    const transaction = db.transaction(() => {
      let outstandingAmount = 0;
      let paidAmount = 0;
      
      if (purchaseData.bill_type === 'credit') {
        outstandingAmount = parseFloat(purchaseData.outstanding_amount) || parseFloat(purchaseData.bill_amount);
        paidAmount = parseFloat(purchaseData.paid_amount) || 0;
      } else {
        // Cash purchase - fully paid
        paidAmount = parseFloat(purchaseData.bill_amount);
        outstandingAmount = 0;
      }
      
      const stmt = db.prepare(`
        INSERT INTO purchases (
          title, bill_type, bill_amount, paid_amount, outstanding_amount,
          bill_file_path, bill_file_name, purchase_date, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      return stmt.run(
        purchaseData.title.trim(),
        purchaseData.bill_type,
        parseFloat(purchaseData.bill_amount),
        paidAmount,
        outstandingAmount,
        purchaseData.bill_file_path || null,
        purchaseData.bill_file_name || null,
        purchaseData.purchase_date || new Date().toISOString().slice(0, 10),
        purchaseData.notes?.trim() || null,
        userId
      );
    });
    
    return transaction();
  },
  
  // Get purchases with filters
  getAll: (filters = {}) => {
    let query = `
      SELECT p.*, u.username as created_by_name
      FROM purchases p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    // Filter by type
    if (filters.bill_type && ['credit', 'cash'].includes(filters.bill_type)) {
      query += ` AND p.bill_type = ?`;
      params.push(filters.bill_type);
    }
    
    // Filter by date range
    if (filters.dateFrom) {
      query += ` AND p.purchase_date >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND p.purchase_date <= ?`;
      params.push(filters.dateTo);
    }
    
    // Filter by outstanding (only credit with outstanding)
    if (filters.showOutstanding) {
      query += ` AND p.bill_type = 'credit' AND p.outstanding_amount > 0`;
    }
    
    // Search by title
    if (filters.search) {
      query += ` AND p.title LIKE ?`;
      params.push(`%${filters.search}%`);
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'purchase_date';
    const order = filters.order || 'DESC';
    const validSorts = ['purchase_date', 'bill_amount', 'outstanding_amount', 'title', 'uploaded_at'];
    const safeSort = validSorts.includes(sortBy) ? sortBy : 'purchase_date';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${safeSort} ${safeOrder}`;
    
    // Limit
    if (filters.limit && !isNaN(parseInt(filters.limit))) {
      const limit = parseInt(filters.limit);
      if (limit > 0 && limit <= 1000) {
        query += ` LIMIT ?`;
        params.push(limit);
      }
    }
    
    return db.prepare(query).all(...params);
  },
  
  // Get purchase by ID
  getById: (id) => {
    return db.prepare(`
      SELECT p.*, u.username as created_by_name
      FROM purchases p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(id);
  },
  
  // Update purchase (especially payment status)
  update: (id, purchaseData) => {
    const stmt = db.prepare(`
      UPDATE purchases SET
        title = ?,
        bill_amount = ?,
        paid_amount = ?,
        outstanding_amount = ?,
        bill_type = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    return stmt.run(
      purchaseData.title.trim(),
      parseFloat(purchaseData.bill_amount),
      parseFloat(purchaseData.paid_amount) || 0,
      parseFloat(purchaseData.outstanding_amount) || 0,
      purchaseData.bill_type,
      purchaseData.notes?.trim() || null,
      id
    );
  },
  
  // Update payment (partial/full payment for credit purchases)
  updatePayment: (id, paymentData) => {
    const transaction = db.transaction(() => {
      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
      if (!purchase) throw new Error('Purchase not found');
      
      if (purchase.bill_type !== 'credit') {
        throw new Error('Can only update payment for credit purchases');
      }
      
      const additionalPayment = parseFloat(paymentData.paid_amount) || 0;
      if (additionalPayment <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }
      
      const newPaidAmount = purchase.paid_amount + additionalPayment;
      const newOutstanding = Math.max(0, purchase.bill_amount - newPaidAmount);
      
      const stmt = db.prepare(`
        UPDATE purchases SET
          paid_amount = ?,
          outstanding_amount = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      return stmt.run(newPaidAmount, newOutstanding, id);
    });
    
    return transaction();
  },
  
  // Delete purchase
  delete: (id) => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    if (!purchase) return { changes: 0 };
    
    // Delete file if exists
    if (purchase.bill_file_path) {
      try {
        const filePath = path.join(__dirname, '..', purchase.bill_file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    
    return db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
  },
  
  // Get statistics
  getStats: (filters = {}) => {
    let query = `
      SELECT 
        COUNT(*) as total_purchases,
        COUNT(CASE WHEN bill_type = 'credit' THEN 1 END) as credit_count,
        COUNT(CASE WHEN bill_type = 'cash' THEN 1 END) as cash_count,
        SUM(bill_amount) as total_amount,
        SUM(CASE WHEN bill_type = 'credit' THEN bill_amount ELSE 0 END) as total_credit,
        SUM(CASE WHEN bill_type = 'cash' THEN bill_amount ELSE 0 END) as total_cash,
        SUM(CASE WHEN bill_type = 'credit' THEN outstanding_amount ELSE 0 END) as total_outstanding,
        SUM(CASE WHEN bill_type = 'credit' THEN paid_amount ELSE 0 END) as total_credit_paid
      FROM purchases
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.dateFrom) {
      query += ` AND purchase_date >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND purchase_date <= ?`;
      params.push(filters.dateTo);
    }
    
    return db.prepare(query).get(...params);
  }
};

module.exports = Purchase;
const db = require('../config/database');

const initExpensesTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reason TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER NOT NULL,
      expense_date DATETIME NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
  `);
};

const Expense = {
  init: initExpensesTable,
  
  // Create expense
  create: (expenseData, userId) => {
    const stmt = db.prepare(`
      INSERT INTO expenses (reason, amount, category_id, expense_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(
      expenseData.reason.trim(),
      parseFloat(expenseData.amount),
      expenseData.category_id,
      expenseData.expense_date || new Date().toISOString(),
      userId
    );
  },
  
  // Get expenses with filters
  getAll: (filters = {}) => {
    let query = `
      SELECT e.*, c.name as category_name, c.color as category_color, u.username as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    // Date range filter
    if (filters.dateFrom) {
      query += ` AND e.expense_date >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      // Include entire end date
      query += ` AND e.expense_date < datetime(?, '+1 day')`;
      params.push(filters.dateTo);
    }
    
    // Category filter
    if (filters.categoryId) {
      query += ` AND e.category_id = ?`;
      params.push(filters.categoryId);
    }
    
    // Search by reason
    if (filters.search) {
      query += ` AND e.reason LIKE ?`;
      params.push(`%${filters.search}%`);
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'expense_date';
    const order = filters.order || 'DESC';
    const validSorts = ['expense_date', 'amount', 'category_name', 'reason', 'created_at'];
    const safeSort = validSorts.includes(sortBy) ? sortBy : 'expense_date';
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
  
  // Get expense by ID
  getById: (id) => {
    return db.prepare(`
      SELECT e.*, c.name as category_name, c.color as category_color, u.username as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `).get(id);
  },
  
  // Update expense
  update: (id, expenseData, userId) => {
    const stmt = db.prepare(`
      UPDATE expenses SET
        reason = ?,
        amount = ?,
        category_id = ?,
        expense_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      expenseData.reason.trim(),
      parseFloat(expenseData.amount),
      expenseData.category_id,
      expenseData.expense_date,
      id
    );
  },
  
  // Delete expense
  delete: (id) => {
    return db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  },
  
  // Get total expenses for a date range
  getTotal: (filters = {}) => {
    let query = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1`;
    const params = [];
    
    if (filters.dateFrom) {
      query += ` AND expense_date >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND expense_date < datetime(?, '+1 day')`;
      params.push(filters.dateTo);
    }
    if (filters.categoryId) {
      query += ` AND category_id = ?`;
      params.push(filters.categoryId);
    }
    
    const result = db.prepare(query).get(...params);
    return parseFloat(result.total || 0);
  },
  
  // Get expenses grouped by category for reports
  getByCategory: (filters = {}) => {
    let query = `
      SELECT 
        c.name as category_name,
        c.color as category_color,
        COUNT(e.id) as count,
        SUM(e.amount) as total
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.dateFrom) {
      query += ` AND e.expense_date >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND e.expense_date < datetime(?, '+1 day')`;
      params.push(filters.dateTo);
    }
    
    query += ` GROUP BY c.id ORDER BY total DESC`;
    
    return db.prepare(query).all(...params);
  }
};

module.exports = Expense;
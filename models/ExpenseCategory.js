const db = require('../config/database');

const initExpenseCategoriesTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_expense_categories_name ON expense_categories(name);
  `);
  
  // Insert default categories if table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM expense_categories').get();
  if (count.count === 0) {
    const defaults = [
      { name: 'Fuel', description: 'Vehicle fuel expenses', color: '#ef4444' },
      { name: 'Salary', description: 'Staff salaries', color: '#3b82f6' },
      { name: 'Utility', description: 'Electricity, water, internet', color: '#8b5cf6' },
      { name: 'Food', description: 'Meals and refreshments', color: '#f59e0b' },
      { name: 'Transport', description: 'Vehicle maintenance, repairs', color: '#10b981' },
      { name: 'Office Supplies', description: 'Stationery, printing', color: '#6366f1' },
      { name: 'Marketing', description: 'Advertising, promotions', color: '#ec4899' },
      { name: 'Maintenance', description: 'Building/equipment repairs', color: '#14b8a6' },
      { name: 'Other', description: 'Miscellaneous expenses', color: '#6b7280' }
    ];
    
    const stmt = db.prepare('INSERT INTO expense_categories (name, description, color) VALUES (?, ?, ?)');
    defaults.forEach(cat => stmt.run(cat.name, cat.description, cat.color));
  }
};

const ExpenseCategory = {
  init: initExpenseCategoriesTable,
  
  getAll: () => {
    return db.prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name ASC').all();
  },
  
  create: (name, description = null, color = '#3b82f6') => {
    const stmt = db.prepare('INSERT INTO expense_categories (name, description, color) VALUES (?, ?, ?)');
    return stmt.run(name.trim(), description?.trim() || null, color);
  },
  
  update: (id, name, description = null, color = null) => {
    const updates = ['name = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [name.trim()];
    
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description?.trim() || null);
    }
    if (color) {
      updates.push('color = ?');
      params.push(color);
    }
    params.push(id);
    
    const stmt = db.prepare(`UPDATE expense_categories SET ${updates.join(', ')} WHERE id = ?`);
    return stmt.run(...params);
  },
  
  delete: (id) => {
    // Soft delete: set is_active to 0
    return db.prepare('UPDATE expense_categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },
  
  getById: (id) => {
    return db.prepare('SELECT * FROM expense_categories WHERE id = ? AND is_active = 1').get(id);
  }
};

module.exports = ExpenseCategory;
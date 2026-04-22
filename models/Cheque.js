const db = require('../config/database');

const initChequesTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cheques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      cheque_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      cheque_date DATE NOT NULL,
      remind_date DATE NOT NULL,
      type TEXT CHECK(type IN ('incoming', 'outgoing')) NOT NULL,
      status TEXT CHECK(status IN ('pending', 'cleared', 'bounced')) DEFAULT 'pending',
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_cheques_company ON cheques(company_name);
    CREATE INDEX IF NOT EXISTS idx_cheques_number ON cheques(cheque_number);
    CREATE INDEX IF NOT EXISTS idx_cheques_date ON cheques(cheque_date);
    CREATE INDEX IF NOT EXISTS idx_cheques_status ON cheques(status);
    CREATE INDEX IF NOT EXISTS idx_cheques_remind ON cheques(remind_date);
  `);
};

const Cheque = {
  init: initChequesTable,
  
  // Get unique company names for autocomplete
  getUniqueCompanies: () => {
    return db.prepare(`
      SELECT DISTINCT company_name FROM cheques 
      WHERE company_name IS NOT NULL AND company_name != ''
      ORDER BY company_name ASC
    `).all().map(row => row.company_name);
  },
  
  // Create cheque
  create: (chequeData, userId) => {
    const transaction = db.transaction(() => {
      // Calculate remind date: cheque_date - 1 day
      const chequeDate = new Date(chequeData.cheque_date);
      const remindDate = new Date(chequeDate);
      remindDate.setDate(remindDate.getDate() - 1);
      
      const stmt = db.prepare(`
        INSERT INTO cheques (
          company_name, cheque_number, amount, cheque_date, remind_date,
          type, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      return stmt.run(
        chequeData.company_name.trim(),
        chequeData.cheque_number.trim(),
        parseFloat(chequeData.amount),
        chequeData.cheque_date,
        remindDate.toISOString().slice(0, 10),
        chequeData.type,
        chequeData.status || 'pending',
        chequeData.notes?.trim() || null,
        userId
      );
    });
    
    return transaction();
  },
  
  // Get cheques with filters
  getAll: (filters = {}) => {
    let query = `
      SELECT c.*, u.username as created_by_name
      FROM cheques c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    // Filter by company
    if (filters.company) {
      query += ` AND c.company_name LIKE ?`;
      params.push(`%${filters.company}%`);
    }
    
    // Filter by type
    if (filters.type && ['incoming', 'outgoing'].includes(filters.type)) {
      query += ` AND c.type = ?`;
      params.push(filters.type);
    }
    
    // Filter by status
    if (filters.status && ['pending', 'cleared', 'bounced'].includes(filters.status)) {
      query += ` AND c.status = ?`;
      params.push(filters.status);
    }
    
    // Filter by date range
    if (filters.dateFrom) {
      query += ` AND c.cheque_date >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND c.cheque_date <= ?`;
      params.push(filters.dateTo);
    }
    
    // Search by cheque number or notes
    if (filters.search) {
      query += ` AND (c.cheque_number LIKE ? OR c.notes LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term);
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'cheque_date';
    const order = filters.order || 'DESC';
    const validSorts = ['cheque_date', 'amount', 'company_name', 'cheque_number', 'status', 'created_at'];
    const safeSort = validSorts.includes(sortBy) ? sortBy : 'cheque_date';
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
  
  // Get cheque by ID
  getById: (id) => {
    return db.prepare(`
      SELECT c.*, u.username as created_by_name
      FROM cheques c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `).get(id);
  },
  
  // Update cheque
  update: (id, chequeData, userId) => {
    const stmt = db.prepare(`
      UPDATE cheques SET
        company_name = ?,
        cheque_number = ?,
        amount = ?,
        cheque_date = ?,
        type = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    // Recalculate remind date if cheque_date changed
    let remindDate = chequeData.remind_date;
    if (chequeData.cheque_date) {
      const newDate = new Date(chequeData.cheque_date);
      const newRemind = new Date(newDate);
      newRemind.setDate(newRemind.getDate() - 1);
      remindDate = newRemind.toISOString().slice(0, 10);
    }
    
    return stmt.run(
      chequeData.company_name.trim(),
      chequeData.cheque_number.trim(),
      parseFloat(chequeData.amount),
      chequeData.cheque_date,
      chequeData.type,
      chequeData.status,
      chequeData.notes?.trim() || null,
      id
    );
  },
  
  // Delete cheque
  delete: (id) => {
    return db.prepare('DELETE FROM cheques WHERE id = ?').run(id);
  },
  
  // Get cheques needing reminders (due in 1-2 days)
  getUpcomingReminders: () => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    return db.prepare(`
      SELECT *, 
        CASE 
          WHEN remind_date = ? THEN 1
          WHEN remind_date = ? THEN 2
          ELSE 0
        END as days_until_due
      FROM cheques
      WHERE status = 'pending' 
        AND remind_date IN (?, ?)
      ORDER BY cheque_date ASC
    `).all(today, tomorrow, today, tomorrow);
  },
  
  // Get dashboard summary
  getDashboardSummary: () => {
    const today = new Date().toISOString().slice(0, 10);
    
    return {
      pending: db.prepare('SELECT COUNT(*) as count FROM cheques WHERE status = ?').get('pending').count,
      dueToday: db.prepare('SELECT COUNT(*) as count FROM cheques WHERE status = ? AND cheque_date = ?').get('pending', today).count,
      dueTomorrow: db.prepare('SELECT COUNT(*) as count FROM cheques WHERE status = ? AND cheque_date = ?').get('pending', 
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      ).count,
      totalIncoming: db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM cheques WHERE type = ? AND status != ?').get('incoming', 'bounced').total,
      totalOutgoing: db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM cheques WHERE type = ? AND status != ?').get('outgoing', 'bounced').total,
    };
  }
};

module.exports = Cheque;
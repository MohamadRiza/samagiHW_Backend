const db = require('../config/database');

// Initialize customers table
const initCustomersTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_type TEXT CHECK(customer_type IN ('individual', 'company')) DEFAULT 'individual',
      name TEXT NOT NULL,
      company_name TEXT,
      mobile TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      nic_id TEXT,
      outstanding_balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);
  `);
};

const Customer = {
  init: initCustomersTable,
  
  // Create new customer
  create: (customerData) => {
    const stmt = db.prepare(`
      INSERT INTO customers (
        customer_type, name, company_name, mobile, email, 
        address, city, nic_id, outstanding_balance, credit_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      customerData.customer_type || 'individual',
      customerData.name,
      customerData.company_name || null,
      customerData.mobile,
      customerData.email || null,
      customerData.address,
      customerData.city,
      customerData.nic_id || null,
      customerData.outstanding_balance || 0,
      customerData.credit_limit || 0
    );
  },
  
  // Get all active customers
  getAll: () => {
    return db.prepare(`
      SELECT * FROM customers 
      WHERE is_active = 1 
      ORDER BY name ASC
    `).all();
  },
  
  // Get customer by ID
  getById: (id) => {
    return db.prepare('SELECT * FROM customers WHERE id = ? AND is_active = 1').get(id);
  },
  
  // Get customer by mobile
  getByMobile: (mobile) => {
    return db.prepare('SELECT * FROM customers WHERE mobile = ? AND is_active = 1').get(mobile);
  },
  
  // Update customer outstanding balance
  updateOutstanding: (customerId, amount) => {
    return db.prepare(`
      UPDATE customers 
      SET outstanding_balance = outstanding_balance + ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(amount, customerId);
  },
  
  // Update customer details
  update: (id, customerData) => {
    const stmt = db.prepare(`
      UPDATE customers SET
        name = ?,
        company_name = ?,
        mobile = ?,
        email = ?,
        address = ?,
        city = ?,
        nic_id = ?,
        credit_limit = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    return stmt.run(
      customerData.name,
      customerData.company_name || null,
      customerData.mobile,
      customerData.email || null,
      customerData.address,
      customerData.city,
      customerData.nic_id || null,
      customerData.credit_limit || 0,
      id
    );
  },
  
  search: (query) => {
  if (!query || query.length < 2) return [];
  
  const searchTerm = `%${query}%`;
  const results = db.prepare(`
    SELECT * FROM customers 
    WHERE is_active = 1 
    AND (
      name LIKE ? 
      OR company_name LIKE ? 
      OR mobile LIKE ?
      OR city LIKE ?
    )
    ORDER BY name ASC
    LIMIT 20
  `).all(searchTerm, searchTerm, searchTerm, searchTerm);
  
  return results || [];
}, catch (error) {
  console.error('Customer search error:', error);
  return [];
}
};

module.exports = Customer;
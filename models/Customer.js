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
},

getCreditCustomers: (filters = {}) => {
  try {
    // Base query: customers who have at least one credit bill
    let query = `
      SELECT 
        c.*,
        COUNT(CASE WHEN cb.status != 'paid' AND cb.outstanding_amount > 0 THEN cb.id END) as pending_bills,
        COUNT(CASE WHEN cb.status = 'paid' OR cb.outstanding_amount <= 0 THEN cb.id END) as settled_bills,
        COUNT(cb.id) as total_bills,
        COALESCE(SUM(CASE WHEN cb.status != 'paid' AND cb.outstanding_amount > 0 THEN cb.outstanding_amount END), 0) as total_outstanding,
        COALESCE(SUM(cb.grand_total), 0) as total_billed,
        COALESCE(SUM(cb.paid_amount), 0) as total_paid,
        MAX(cb.created_at) as last_bill_date,
        MIN(cb.created_at) as first_bill_date
      FROM customers c
      INNER JOIN credit_bills cb ON c.id = cb.customer_id
      WHERE c.is_active = 1
    `;
    
    const params = [];
    
    // Filter by search (name, company, mobile, city)
    if (filters.search && typeof filters.search === 'string' && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim()}%`;
      query += ` AND (c.name LIKE ? OR c.company_name LIKE ? OR c.mobile LIKE ? OR c.city LIKE ? OR c.nic_id LIKE ?)`;
      params.push(term, term, term, term, term);
    }
    
    // Filter by outstanding balance range
    if (filters.minOutstanding !== undefined && !isNaN(parseFloat(filters.minOutstanding))) {
      query += ` AND (SELECT COALESCE(SUM(CASE WHEN status != 'paid' AND outstanding_amount > 0 THEN outstanding_amount END), 0) FROM credit_bills WHERE customer_id = c.id) >= ?`;
      params.push(parseFloat(filters.minOutstanding));
    }
    if (filters.maxOutstanding !== undefined && !isNaN(parseFloat(filters.maxOutstanding))) {
      query += ` AND (SELECT COALESCE(SUM(CASE WHEN status != 'paid' AND outstanding_amount > 0 THEN outstanding_amount END), 0) FROM credit_bills WHERE customer_id = c.id) <= ?`;
      params.push(parseFloat(filters.maxOutstanding));
    }
    
    // Filter by bill count
    if (filters.minBills !== undefined && !isNaN(parseInt(filters.minBills))) {
      query += ` HAVING COUNT(cb.id) >= ?`;
      params.push(parseInt(filters.minBills));
    }
    
    // Group by customer
    query += ` GROUP BY c.id`;
    
    // Sorting
    const sortBy = filters.sortBy || 'name';
    const order = filters.order || 'ASC';
    
    const validSortColumns = {
      'name': 'c.name',
      'company_name': 'c.company_name',
      'mobile': 'c.mobile',
      'city': 'c.city',
      'total_outstanding': 'total_outstanding',
      'total_bills': 'total_bills',
      'pending_bills': 'pending_bills',
      'last_bill_date': 'last_bill_date'
    };
    
    const safeSortColumn = validSortColumns[sortBy] || 'c.name';
    const safeOrder = order?.toString().toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${safeSortColumn} ${safeOrder}`;
    
    // Limit
    if (filters.limit && !isNaN(parseInt(filters.limit))) {
      const limit = parseInt(filters.limit);
      if (limit > 0 && limit <= 1000) {
        query += ` LIMIT ?`;
        params.push(limit);
      }
    }
    
    return db.prepare(query).all(...params);
    
  } catch (error) {
    console.error('Customer.getCreditCustomers error:', error);
    throw error;
  }
},

// ✅ Get single customer with full bill history and stats
getCustomerWithStats: (customerId) => {
  try {
    // Get customer details
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND is_active = 1').get(customerId);
    if (!customer) return null;
    
    // Get bill stats
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_bills,
        COUNT(CASE WHEN status != 'paid' AND outstanding_amount > 0 THEN 1 END) as pending_bills,
        COUNT(CASE WHEN status = 'paid' OR outstanding_amount <= 0 THEN 1 END) as settled_bills,
        COALESCE(SUM(grand_total), 0) as total_billed,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status != 'paid' AND outstanding_amount > 0 THEN outstanding_amount END), 0) as total_outstanding,
        MIN(created_at) as first_bill,
        MAX(created_at) as last_bill
      FROM credit_bills
      WHERE customer_id = ?
    `).get(customerId);
    
    // Get recent bills (last 10)
    const recentBills = db.prepare(`
      SELECT cb.*, 
        CASE 
          WHEN cb.status = 'paid' THEN 'Paid'
          WHEN cb.outstanding_amount <= 0 THEN 'Paid'
          WHEN cb.due_date < date('now') THEN 'Overdue'
          ELSE 'Pending'
        END as status_label
      FROM credit_bills cb
      WHERE cb.customer_id = ?
      ORDER BY cb.created_at DESC
      LIMIT 10
    `).all(customerId);
    
    // Format bills for frontend
    const formattedBills = recentBills.map(bill => ({
      ...bill,
      due_date: bill.due_date ? new Date(bill.due_date).toISOString().slice(0, 10) : null,
      created_at: new Date(bill.created_at).toISOString(),
      updated_at: bill.updated_at ? new Date(bill.updated_at).toISOString() : null
    }));
    
    return {
      ...customer,
      stats: {
        total_bills: stats.total_bills || 0,
        pending_bills: stats.pending_bills || 0,
        settled_bills: stats.settled_bills || 0,
        total_billed: parseFloat(stats.total_billed || 0),
        total_paid: parseFloat(stats.total_paid || 0),
        total_outstanding: parseFloat(stats.total_outstanding || 0),
        first_bill: stats.first_bill ? new Date(stats.first_bill).toISOString() : null,
        last_bill: stats.last_bill ? new Date(stats.last_bill).toISOString() : null
      },
      recent_bills: formattedBills
    };
    
  } catch (error) {
    console.error('Customer.getCustomerWithStats error:', error);
    return null;
  }
}

};

module.exports = Customer;
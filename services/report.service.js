const db = require('../config/database');

class ReportService {
  // Get today's summary
  static getTodaySummary() {
    const today = new Date().toISOString().slice(0, 10);
    
    // Cash sales today
    const cashSales = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(grand_total), 0) as total,
        COALESCE(SUM(total_discount), 0) as discount
      FROM bills 
      WHERE DATE(created_at) = ? AND status = 'COMPLETED'
    `).get(today);
    
    // Credit sales today
    const creditSales = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(grand_total), 0) as total,
        COALESCE(SUM(outstanding_amount), 0) as outstanding
      FROM credit_bills 
      WHERE DATE(created_at) = ?
    `).get(today);
    
    // Expenses today
    const expenses = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses 
      WHERE DATE(expense_date) = ?
    `).get(today);
    
    // Cheques today
    const cheques = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM cheques 
      WHERE DATE(cheque_date) = ?
    `).get(today);
    
    // Purchases today
    const purchases = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(bill_amount), 0) as total
      FROM purchases 
      WHERE DATE(purchase_date) = ?
    `).get(today);
    
    // Low stock items
    const lowStock = db.prepare(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE stock_quantity <= 10 AND is_active = 1
    `).get();
    
    return {
      date: today,
      cashSales: {
        count: cashSales.count || 0,
        total: parseFloat(cashSales.total) || 0,
        discount: parseFloat(cashSales.discount) || 0
      },
      creditSales: {
        count: creditSales.count || 0,
        total: parseFloat(creditSales.total) || 0,
        outstanding: parseFloat(creditSales.outstanding) || 0
      },
      expenses: {
        count: expenses.count || 0,
        total: parseFloat(expenses.total) || 0
      },
      cheques: {
        count: cheques.count || 0,
        total: parseFloat(cheques.total) || 0
      },
      purchases: {
        count: purchases.count || 0,
        total: parseFloat(purchases.total) || 0
      },
      lowStock: lowStock.count || 0,
      netProfit: (parseFloat(cashSales.total) + parseFloat(creditSales.total)) - 
                 (parseFloat(expenses.total) + parseFloat(purchases.total))
    };
  }
  
  // Get sales report with filters
  static getSalesReport(filters = {}) {
    let query = `
      SELECT 
        b.id,
        b.bill_number,
        b.grand_total,
        b.total_discount,
        b.payment_method,
        b.cashier_name,
        b.created_at,
        (SELECT COUNT(*) FROM bill_items WHERE bill_id = b.id) as item_count
      FROM bills b
      WHERE b.status = 'COMPLETED'
    `;
    
    const params = [];
    
    // Date range filter
    if (filters.dateFrom) {
      query += ` AND DATE(b.created_at) >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND DATE(b.created_at) <= ?`;
      params.push(filters.dateTo);
    }
    
    // Payment method filter
    if (filters.paymentMethod) {
      query += ` AND b.payment_method = ?`;
      params.push(filters.paymentMethod);
    }
    
    // Cashier filter
    if (filters.cashier) {
      query += ` AND b.cashier_name LIKE ?`;
      params.push(`%${filters.cashier}%`);
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'created_at';
    const order = filters.order || 'DESC';
    const validSorts = ['created_at', 'grand_total', 'bill_number'];
    const safeSort = validSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${safeSort} ${safeOrder}`;
    
    // Limit
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }
    
    const bills = db.prepare(query).all(...params);
    
    // Calculate totals
    const totals = {
      totalBills: bills.length,
      totalRevenue: bills.reduce((sum, b) => sum + b.grand_total, 0),
      totalDiscount: bills.reduce((sum, b) => sum + b.total_discount, 0),
      cashSales: bills.filter(b => b.payment_method === 'CASH').reduce((sum, b) => sum + b.grand_total, 0),
      cardSales: bills.filter(b => b.payment_method === 'CARD').reduce((sum, b) => sum + b.grand_total, 0)
    };
    
    return { bills, totals };
  }
  
  // Get credit sales report
  static getCreditSalesReport(filters = {}) {
    let query = `
      SELECT 
        cb.id,
        cb.bill_number,
        cb.customer_name,
        cb.customer_mobile,
        cb.grand_total,
        cb.paid_amount,
        cb.outstanding_amount,
        cb.status,
        cb.due_date,
        cb.created_at
      FROM credit_bills cb
      WHERE 1=1
    `;
    
    const params = [];
    
    // Date range
    if (filters.dateFrom) {
      query += ` AND DATE(cb.created_at) >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND DATE(cb.created_at) <= ?`;
      params.push(filters.dateTo);
    }
    
    // Status filter
    if (filters.status && ['pending', 'partial', 'paid'].includes(filters.status)) {
      query += ` AND cb.status = ?`;
      params.push(filters.status);
    }
    
    // Customer search
    if (filters.customer) {
      query += ` AND (cb.customer_name LIKE ? OR cb.customer_mobile LIKE ?)`;
      const term = `%${filters.customer}%`;
      params.push(term, term);
    }
    
    const sortBy = filters.sortBy || 'created_at';
    const order = filters.order || 'DESC';
    query += ` ORDER BY ${sortBy} ${order}`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }
    
    const bills = db.prepare(query).all(...params);
    
    const totals = {
      totalBills: bills.length,
      totalRevenue: bills.reduce((sum, b) => sum + b.grand_total, 0),
      totalPaid: bills.reduce((sum, b) => sum + b.paid_amount, 0),
      totalOutstanding: bills.reduce((sum, b) => sum + b.outstanding_amount, 0)
    };
    
    return { bills, totals };
  }
  
  // Get stock report
  static getStockReport(filters = {}) {
    let query = `
      SELECT 
        id,
        barcode,
        item_name,
        short_form,
        buying_price,
        selling_price,
        stock_quantity,
        company,
        (selling_price - buying_price) as profit_margin,
        CASE 
          WHEN stock_quantity <= 10 THEN 'Low'
          WHEN stock_quantity <= 50 THEN 'Medium'
          ELSE 'Good'
        END as stock_status
      FROM products
      WHERE is_active = 1
    `;
    
    const params = [];
    
    // Search
    if (filters.search) {
      query += ` AND (item_name LIKE ? OR barcode LIKE ? OR company LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }
    
    // Low stock only
    if (filters.lowStockOnly) {
      query += ` AND stock_quantity <= 10`;
    }
    
    // Company filter
    if (filters.company) {
      query += ` AND company LIKE ?`;
      params.push(`%${filters.company}%`);
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'item_name';
    const order = filters.order || 'ASC';
    const validSorts = ['item_name', 'stock_quantity', 'buying_price', 'selling_price', 'company'];
    const safeSort = validSorts.includes(sortBy) ? sortBy : 'item_name';
    
    query += ` ORDER BY ${safeSort} ${order}`;
    
    const products = db.prepare(query).all(...params);
    
    const totals = {
      totalProducts: products.length,
      totalStockValue: products.reduce((sum, p) => sum + (p.buying_price * p.stock_quantity), 0),
      totalRetailValue: products.reduce((sum, p) => sum + (p.selling_price * p.stock_quantity), 0),
      lowStockCount: products.filter(p => p.stock_quantity <= 10).length,
      outOfStockCount: products.filter(p => p.stock_quantity === 0).length
    };
    
    return { products, totals };
  }
  
  // Get expense report
  static getExpenseReport(filters = {}) {
    let query = `
      SELECT 
        e.*,
        ec.name as category_name,
        u.username as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Date range
    if (filters.dateFrom) {
      query += ` AND DATE(e.expense_date) >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND DATE(e.expense_date) <= ?`;
      params.push(filters.dateTo);
    }
    
    // Category filter
    if (filters.categoryId) {
      query += ` AND e.category_id = ?`;
      params.push(filters.categoryId);
    }
    
    const sortBy = filters.sortBy || 'expense_date';
    const order = filters.order || 'DESC';
    query += ` ORDER BY ${sortBy} ${order}`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }
    
    const expenses = db.prepare(query).all(...params);
    
    const totals = {
      totalExpenses: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0)
    };
    
    return { expenses, totals };
  }
  
  // Get purchase report
  static getPurchaseReport(filters = {}) {
    let query = `
      SELECT 
        p.*,
        u.username as created_by_name
      FROM purchases p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Date range
    if (filters.dateFrom) {
      query += ` AND DATE(p.purchase_date) >= ?`;
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      query += ` AND DATE(p.purchase_date) <= ?`;
      params.push(filters.dateTo);
    }
    
    // Type filter
    if (filters.billType) {
      query += ` AND p.bill_type = ?`;
      params.push(filters.billType);
    }
    
    const sortBy = filters.sortBy || 'purchase_date';
    const order = filters.order || 'DESC';
    query += ` ORDER BY ${sortBy} ${order}`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(filters.limit));
    }
    
    const purchases = db.prepare(query).all(...params);
    
    const totals = {
      totalPurchases: purchases.length,
      totalAmount: purchases.reduce((sum, p) => sum + p.bill_amount, 0),
      totalOutstanding: purchases.reduce((sum, p) => sum + p.outstanding_amount, 0)
    };
    
    return { purchases, totals };
  }
}

module.exports = ReportService;
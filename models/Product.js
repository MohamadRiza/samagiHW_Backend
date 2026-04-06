const db = require('../config/database');

// Initialize products table with all required fields
const initProductsTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      item_name TEXT NOT NULL,
      short_form TEXT,
      buying_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      discount_type TEXT CHECK(discount_type IN ('percent', 'amount')) DEFAULT 'percent',
      discount_value REAL DEFAULT 0,
      company TEXT,
      is_credit_item INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(item_name);
    CREATE INDEX IF NOT EXISTS idx_products_company ON products(company);
  `);
};

// Auto-generate unique barcode (Code128 compatible format)
const generateBarcode = () => {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SH${timestamp}${random}`; // Format: SH240615123456
};

// CRUD Operations
const Product = {
  init: initProductsTable,
  
  // Create new product
  create: (productData) => {
    const barcode = generateBarcode();
    const stmt = db.prepare(`
      INSERT INTO products (
        barcode, item_name, short_form, buying_price, selling_price,
        stock_quantity, discount_type, discount_value, company, is_credit_item
      ) VALUES (
        @barcode, @item_name, @short_form, @buying_price, @selling_price,
        @stock_quantity, @discount_type, @discount_value, @company, @is_credit_item
      )
    `);
    
    return stmt.run({
      barcode,
      item_name: productData.item_name,
      short_form: productData.short_form || null,
      buying_price: parseFloat(productData.buying_price),
      selling_price: parseFloat(productData.selling_price),
      stock_quantity: parseInt(productData.stock_quantity) || 0,
      discount_type: productData.discount_type || 'percent',
      discount_value: parseFloat(productData.discount_value) || 0,
      company: productData.company || null,
      is_credit_item: productData.is_credit_item ? 1 : 0
    });
  },
  
  // Get all products with search/filter
  getAll: (filters = {}) => {
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];
    
    if (filters.search) {
      query += ` AND (item_name LIKE ? OR barcode LIKE ? OR short_form LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.creditOnly) {
      query += ' AND is_credit_item = 1';
    }
    
    if (filters.company) {
      query += ' AND company LIKE ?';
      params.push(`%${filters.company}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return db.prepare(query).all(...params);
  },
  
  // Get single product by ID or barcode
  getById: (id) => db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(id),
  getByBarcode: (barcode) => db.prepare('SELECT * FROM products WHERE barcode = ? AND is_active = 1').get(barcode),
  
  // Update product
  update: (id, productData) => {
    const stmt = db.prepare(`
      UPDATE products SET
        item_name = @item_name,
        short_form = @short_form,
        buying_price = @buying_price,
        selling_price = @selling_price,
        stock_quantity = @stock_quantity,
        discount_type = @discount_type,
        discount_value = @discount_value,
        company = @company,
        is_credit_item = @is_credit_item,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND is_active = 1
    `);
    
    return stmt.run({
      id,
      item_name: productData.item_name,
      short_form: productData.short_form || null,
      buying_price: parseFloat(productData.buying_price),
      selling_price: parseFloat(productData.selling_price),
      stock_quantity: parseInt(productData.stock_quantity),
      discount_type: productData.discount_type,
      discount_value: parseFloat(productData.discount_value),
      company: productData.company || null,
      is_credit_item: productData.is_credit_item ? 1 : 0
    });
  },
  
  // Soft delete (deactivate)
  delete: (id) => db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id),
  
  // Deduct stock for billing (billwise qty deduction)
  deductStock: (productId, quantity) => {
    const product = Product.getById(productId);
    if (!product) return { success: false, error: 'Product not found' };
    if (product.stock_quantity < quantity) {
      return { success: false, error: 'Insufficient stock' };
    }
    
    const newStock = product.stock_quantity - quantity;
    return db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStock, productId);
  },
  
  // Add stock (for restocking)
  addStock: (productId, quantity) => {
    const product = Product.getById(productId);
    if (!product) return { success: false, error: 'Product not found' };
    
    const newStock = product.stock_quantity + quantity;
    return db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStock, productId);
  },
  
  // Get low stock items (for alerts)
  getLowStock: (threshold = 10) => {
    return db.prepare('SELECT * FROM products WHERE stock_quantity <= ? AND is_active = 1 ORDER BY stock_quantity ASC')
      .all(threshold);
  }
};

module.exports = Product;
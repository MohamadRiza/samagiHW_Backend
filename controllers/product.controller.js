const Product = require('../models/Product');
const { body, validationResult } = require('express-validator');

// Validation rules
const productValidation = [
  body('item_name').trim().notEmpty().withMessage('Item name is required'),
  body('buying_price').isFloat({ min: 0 }).withMessage('Buying price must be a valid number'),
  body('selling_price').isFloat({ min: 0 }).withMessage('Selling price must be a valid number'),
  body('stock_quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  body('discount_type').isIn(['percent', 'amount']).withMessage('Invalid discount type'),
  body('discount_value').isFloat({ min: 0 }).withMessage('Discount value must be valid')
];

// Get all products with filters
exports.getProducts = (req, res) => {
  try {
    const { search, creditOnly, company } = req.query;
    const products = Product.getAll({ search, creditOnly: creditOnly === 'true', company });
    
    // Calculate final price with discount for display
    const productsWithPricing = products.map(p => ({
      ...p,
      final_price: p.discount_type === 'percent' 
        ? p.selling_price - (p.selling_price * p.discount_value / 100)
        : p.selling_price - p.discount_value
    }));
    
    res.json({ success: true, data: productsWithPricing });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
};

// Get single product
exports.getProduct = (req, res) => {
  try {
    const { id } = req.params;
    const product = Product.getById(id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
};

// Create new product
exports.createProduct = [
  ...productValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      const result = Product.create(req.body);
      const newProduct = Product.getById(result.lastInsertRowid);
      
      res.status(201).json({ 
        success: true, 
        message: 'Product created successfully',
        data: { ...newProduct, barcode: newProduct.barcode }
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ success: false, error: 'Barcode already exists' });
      }
      console.error('Create product error:', error);
      res.status(500).json({ success: false, error: 'Failed to create product' });
    }
  }
];

// Update product
exports.updateProduct = [
  ...productValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      const { id } = req.params;
      const result = Product.update(id, req.body);
      
      if (result.changes === 0) {
        return res.status(404).json({ success: false, error: 'Product not found or inactive' });
      }
      
      const updatedProduct = Product.getById(id);
      res.json({ success: true, message: 'Product updated', data: updatedProduct });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ success: false, error: 'Failed to update product' });
    }
  }
];

// Delete product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = Product.delete(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
};

// Deduct stock for billing
exports.deductStock = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Valid productId and quantity required' });
    }
    
    const result = Product.deductStock(productId, parseInt(quantity));
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    const updatedProduct = Product.getById(productId);
    res.json({ success: true, message: 'Stock updated', data: updatedProduct });
  } catch (error) {
    console.error('Deduct stock error:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock' });
  }
};

// Get low stock alerts
exports.getLowStock = (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const lowStockItems = Product.getLowStock(threshold);
    res.json({ success: true, data: lowStockItems, count: lowStockItems.length });
  } catch (error) {
    console.error('Low stock query error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch low stock items' });
  }
};
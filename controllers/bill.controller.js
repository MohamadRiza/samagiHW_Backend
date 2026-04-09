const Bill = require('../models/Bill');
const Product = require('../models/Product');

// Create bill (Cash or Card)
exports.createBill = (req, res) => {
  try {
    const { items, paymentMethod = 'CASH' } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }
    
    // Validate payment method
    if (!['CASH', 'CARD'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Invalid payment method' });
    }
    
    // Validate items structure
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid item data' });
      }
      if (item.discount_lkr < 0) {
        return res.status(400).json({ success: false, error: 'Invalid discount' });
      }
    }
    
    const result = Bill.create({ items, paymentMethod }, req.user);
    res.status(201).json({ 
      success: true, 
      message: 'Bill saved successfully', 
      data: { ...result, cashier: req.user.username, paymentMethod }
    });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to create bill' });
  }
};

// Get recent bills
exports.getBills = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const bills = Bill.getRecent(limit);
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bills' });
  }
};

// Get single bill details
exports.getBillById = (req, res) => {
  try {
    const bill = Bill.getById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });
    res.json({ success: true,  bill });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bill' });
  }
};
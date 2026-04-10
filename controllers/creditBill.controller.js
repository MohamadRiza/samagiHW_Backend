const CreditBill = require('../models/CreditBill');
const Customer = require('../models/Customer');

// Create credit bill
exports.createCreditBill = (req, res) => {
  try {
    const { customer_id, customer_name, customer_mobile, items, due_date, notes } = req.body;
    
    if (!customer_id || !customer_name || !customer_mobile || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    const result = CreditBill.create({
      customer_id,
      customer_name,
      customer_mobile,
      items,
      due_date,
      notes
    }, req.user);
    
    // ✅ FIX: Added 'data:' key before the object
    res.status(201).json({ 
      success: true, 
      message: 'Credit bill created successfully', 
      data: { ...result, cashier: req.user.username } 
    });
  } catch (error) {
    console.error('Create credit bill error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to create credit bill' });
  }
};

// Get recent credit bills
exports.getCreditBills = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const bills = CreditBill.getRecent(limit);
    // ✅ FIX: Added 'data:' key
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch credit bills' });
  }
};

// Get single credit bill
exports.getCreditBillById = (req, res) => {
  try {
    const bill = CreditBill.getById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }
    // ✅ FIX: Added 'data:' key
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bill' });
  }
};

// Get outstanding bills
exports.getOutstandingBills = (req, res) => {
  try {
    const bills = CreditBill.getOutstanding();
    // ✅ FIX: Added 'data:' key
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch outstanding bills' });
  }
};
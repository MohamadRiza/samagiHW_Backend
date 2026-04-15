const CreditBill = require('../models/CreditBill');

// Create credit bill
exports.createCreditBill = (req, res) => {
  try {
    const { customer_id, customer_name, customer_mobile, items, due_date, notes } = req.body;
    
    if (!customer_id || !customer_name || !customer_mobile || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields', data: null });
    }
    
    const result = CreditBill.create({
      customer_id,
      customer_name,
      customer_mobile,
      items,
      due_date,
      notes
    }, req.user);
    
    res.status(201).json({ 
      success: true, 
      message: 'Credit bill created successfully', 
      data: { ...result, cashier: req.user.username } 
    });
  } catch (error) {
    console.error('Create credit bill error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to create credit bill', data: null });
  }
};

// Get recent credit bills
exports.getCreditBills = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const bills = CreditBill.getRecent(limit);
    res.json({ success: true, data: bills || [] });
  } catch (error) {
    console.error('Get credit bills error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch credit bills', data: [] });
  }
};

// Get single credit bill
exports.getCreditBillById = (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ Validate ID is a number
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid bill ID required', 
        received: id,
        data: null 
      });
    }
    
    const bill = CreditBill.getById(parseInt(id));
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        error: 'Bill not found', 
        data: null 
      });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Get bill by ID error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch bill', 
      data: null 
    });
  }
};

// Get outstanding bills
exports.getOutstandingBills = (req, res) => {
  try {
    const bills = CreditBill.getOutstanding();
    res.json({ success: true, data: bills || [] });
  } catch (error) {
    console.error('Get outstanding bills error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch outstanding bills', data: [] });
  }
};

// ✅ FIXED: Get pending bills with filters - handles 'all' status properly
exports.getPendingBills = (req, res) => {
  try {
    const { search, customerId, status, sortBy, order, limit } = req.query;
    
    // ✅ FIX: Only apply status filter if it's a valid value (not 'all')
    const validStatuses = ['pending', 'partial'];
    const statusFilter = status && validStatuses.includes(status) ? status : null;
    
    const filters = {
      search: search?.trim(),
      customerId: customerId ? parseInt(customerId) : null,
      status: statusFilter, // ✅ Only pass valid status values to model
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };
    
    const bills = CreditBill.getPending(filters);
    
    // Format for frontend
    const formattedBills = (bills || []).map(bill => ({
      ...bill,
      due_date: bill.due_date ? new Date(bill.due_date).toISOString().slice(0, 10) : null,
      created_at: new Date(bill.created_at).toISOString(),
      is_overdue: bill.due_date && new Date(bill.due_date) < new Date() && bill.status !== 'paid'
    }));
    
    res.json({ success: true, data: formattedBills });
  } catch (error) {
    console.error('Get pending bills error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pending bills',
      message: error.message,
      data: [] 
    });
  }
};

// ✅ Update bill payment
exports.updateBillPayment = (req, res) => {
  try {
    const { billId } = req.params;
    const { paid_amount, payment_method, notes } = req.body;
    
    if (!billId || isNaN(billId)) {
      return res.status(400).json({ success: false, error: 'Valid bill ID is required', data: null });
    }
    
    if (!paid_amount || parseFloat(paid_amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required', data: null });
    }
    
    const result = CreditBill.updatePayment(parseInt(billId), {
      paid_amount: parseFloat(paid_amount),
      payment_method: payment_method || 'CASH',
      notes: notes?.trim() || null
    });
    
    // Fetch updated bill for response
    const updatedBill = CreditBill.getById(billId);
    
    res.json({
      success: true,
      message: result.newStatus === 'paid' ? 'Bill marked as paid' : 'Payment recorded',
      data: {
        ...updatedBill,
        payment_result: result
      }
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to update payment', data: null });
  }
};

// ✅ Get customer's bill history
exports.getCustomerBills = (req, res) => {
  try {
    const { customerId } = req.params;
    
    if (!customerId || isNaN(customerId)) {
      return res.status(400).json({ success: false, error: 'Valid customer ID is required', data: [] });
    }
    
    const bills = CreditBill.getByCustomer(parseInt(customerId));
    const formattedBills = (bills || []).map(bill => ({
      ...bill,
      due_date: bill.due_date ? new Date(bill.due_date).toISOString().slice(0, 10) : null,
      created_at: new Date(bill.created_at).toISOString()
    }));
    
    res.json({ success: true, data: formattedBills });
  } catch (error) {
    console.error('Get customer bills error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer bills', data: [] });
  }
};

// ✅ Reprint bill receipt
exports.reprintBill = (req, res) => {
  try {
    const { billId } = req.params;
    
    if (!billId || isNaN(billId)) {
      return res.status(400).json({ success: false, error: 'Valid bill ID is required', data: null });
    }
    
    const bill = CreditBill.getBillWithItems(parseInt(billId));
    
    if (!bill) {
      return res.status(404).json({ success: false, error: 'Bill not found', data: null });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    console.error('Reprint bill error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bill for reprint', data: null });
  }
};
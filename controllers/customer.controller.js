const Customer = require('../models/Customer');

// ✅ Get all customers
exports.getCustomers = (req, res) => {
  try {
    const customers = Customer.getAll();
    
    res.json({
      success: true,
      data: Array.isArray(customers) ? customers : []
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      data: []
    });
  }
};

// ✅ Create customer with robust validation
exports.createCustomer = (req, res) => {
  try {
    const {
      customer_type,
      name,
      company_name,
      mobile,
      email,
      address,
      city,
      nic_id
    } = req.body;

    console.log('📥 Creating customer with data:', req.body);

    // ✅ Trim and validate required fields
    const trimmedName = name?.trim();
    const trimmedMobile = mobile?.trim();
    const trimmedAddress = address?.trim();
    const trimmedCity = city?.trim();

    if (!trimmedName || !trimmedMobile || !trimmedAddress || !trimmedCity) {
      return res.status(400).json({
        success: false,
        error: 'Name, mobile, address, and city are required',
        received: {
          name: trimmedName,
          mobile: trimmedMobile,
          address: trimmedAddress,
          city: trimmedCity
        }
      });
    }

    // ✅ Sri Lankan mobile validation: 07[01245678]XXXXXXXX
    const cleanMobile = trimmedMobile.replace(/\s/g, '');
    if (!/^07[01245678]\d{7}$/.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mobile number format. Use: 07XXXXXXXX (e.g., 0712345678)',
        received: { mobile: trimmedMobile }
      });
    }

    // ✅ Check for duplicate mobile
    const existing = Customer.getByMobile(cleanMobile);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Customer with this mobile number already exists',
        existingCustomerId: existing.id,
        existingCustomer: {
          id: existing.id,
          name: existing.name,
          mobile: existing.mobile
        }
      });
    }

    // ✅ Create customer in database
    const result = Customer.create({
      customer_type: customer_type || 'individual',
      name: trimmedName,
      company_name: company_name?.trim() || null,
      mobile: cleanMobile,
      email: email?.trim() || null,
      address: trimmedAddress,
      city: trimmedCity,
      nic_id: nic_id?.trim() || null,
      outstanding_balance: 0,
      credit_limit: 0
    });

    // ✅ Fetch and return the complete new customer
    const newCustomer = Customer.getById(result.lastInsertRowid);
    
    if (!newCustomer) {
      throw new Error('Failed to retrieve newly created customer');
    }

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: newCustomer
    });

  } catch (error) {
    console.error('❌ Create customer error:', error);
    
    // Handle SQLite constraint errors
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate entry: Customer with this mobile already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create customer',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ✅ Search customers (min 2 characters)
exports.searchCustomers = (req, res) => {
  try {
    const { q } = req.query;
    const query = q?.trim();

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const customers = Customer.search(query);
    
    res.json({
      success: true,
      data: Array.isArray(customers) ? customers : []
    });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search customers',
      data: []
    });
  }
};

// ✅ Get customer by ID
exports.getCustomerById = (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Valid customer ID is required'
      });
    }

    const customer = Customer.getById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer'
    });
  }
};

// ✅ Get credit customers with full stats
exports.getCreditCustomers = (req, res) => {
  try {
    const { search, minOutstanding, maxOutstanding, minBills, sortBy, order, limit } = req.query;
    
    // Build filters object with validated values
    const filters = {};
    
    // Search: only add if non-empty string
    if (search && typeof search === 'string' && search.trim().length >= 2) {
      filters.search = search.trim();
    }
    
    // Outstanding range: only add if valid numbers
    if (minOutstanding && !isNaN(parseFloat(minOutstanding))) {
      filters.minOutstanding = parseFloat(minOutstanding);
    }
    if (maxOutstanding && !isNaN(parseFloat(maxOutstanding))) {
      filters.maxOutstanding = parseFloat(maxOutstanding);
    }
    
    // Min bills: only add if valid number
    if (minBills && !isNaN(parseInt(minBills))) {
      filters.minBills = parseInt(minBills);
    }
    
    // SortBy: whitelist validation
    const validSorts = ['name', 'company_name', 'mobile', 'city', 'total_outstanding', 'total_bills', 'pending_bills', 'last_bill_date'];
    if (sortBy && validSorts.includes(sortBy)) {
      filters.sortBy = sortBy;
    }
    
    // Order: ASC or DESC
    if (order && ['ASC', 'DESC'].includes(order.toUpperCase())) {
      filters.order = order.toUpperCase();
    }
    
    // Limit: valid positive number
    if (limit && !isNaN(parseInt(limit))) {
      const limitNum = parseInt(limit);
      if (limitNum > 0 && limitNum <= 1000) {
        filters.limit = limitNum;
      }
    }
    
    // Get credit customers from model
    const customers = Customer.getCreditCustomers(filters);
    
    // Format for frontend
    const formattedCustomers = (customers || []).map(customer => ({
      ...customer,
      last_bill_date: customer.last_bill_date ? new Date(customer.last_bill_date).toISOString() : null,
      first_bill_date: customer.first_bill_date ? new Date(customer.first_bill_date).toISOString() : null,
      // Ensure numeric fields are properly typed
      total_outstanding: parseFloat(customer.total_outstanding || 0),
      total_billed: parseFloat(customer.total_billed || 0),
      total_paid: parseFloat(customer.total_paid || 0),
      pending_bills: parseInt(customer.pending_bills || 0),
      settled_bills: parseInt(customer.settled_bills || 0),
      total_bills: parseInt(customer.total_bills || 0)
    }));
    
    res.json({ success: true, data: formattedCustomers });
    
  } catch (error) {
    console.error('Get credit customers controller error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch credit customers',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: [] 
    });
  }
};

// ✅ Get single customer with full stats and bill history
exports.getCustomerWithStats = (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid customer ID required', 
        data: null 
      });
    }
    
    const customer = Customer.getCustomerWithStats(parseInt(id));
    
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Customer not found', 
        data: null 
      });
    }
    
    res.json({ success: true, data: customer });
    
  } catch (error) {
    console.error('Get customer with stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch customer details', 
      data: null 
    });
  }
};
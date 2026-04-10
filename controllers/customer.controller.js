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
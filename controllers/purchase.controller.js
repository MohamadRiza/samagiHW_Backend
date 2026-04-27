const Purchase = require('../models/Purchase');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'purchases');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'purchase-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper formatter
const formatPurchase = (purchase) => ({
  ...purchase,
  purchase_date: new Date(purchase.purchase_date).toISOString().slice(0, 10),
  uploaded_at: new Date(purchase.uploaded_at).toISOString(),
  bill_file_url: purchase.bill_file_path
    ? `/api/uploads/purchases/${purchase.bill_file_path.split('/').pop()}`
    : null
});

// Get purchases
exports.getPurchases = (req, res) => {
  try {
    const { bill_type, dateFrom, dateTo, search, showOutstanding, sortBy, order, limit } = req.query;

    const filters = {
      bill_type,
      dateFrom: dateFrom?.trim(),
      dateTo: dateTo?.trim(),
      search: search?.trim(),
      showOutstanding: showOutstanding === 'true',
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };

    const purchases = Purchase.getAll(filters);
    const formattedPurchases = purchases.map(formatPurchase);

    res.json({ success: true, data: formattedPurchases });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purchases' });
  }
};

// Get by ID
exports.getPurchaseById = (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid purchase ID required' });
    }

    const purchase = Purchase.getById(parseInt(id));
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    res.json({
      success: true,
      data: formatPurchase(purchase)
    });
  } catch (error) {
    console.error('Get purchase by ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purchase' });
  }
};

// Create purchase
exports.createPurchase = [
  upload.single('bill_file'),
  (req, res) => {
    try {
      const { title, bill_type, bill_amount, outstanding_amount, paid_amount, purchase_date, notes } = req.body;

      if (!title?.trim() || !bill_type || !bill_amount) {
        return res.status(400).json({
          success: false,
          error: 'Title, bill type, and amount are required'
        });
      }

      if (!['credit', 'cash'].includes(bill_type)) {
        return res.status(400).json({ success: false, error: 'Invalid bill type' });
      }

      const purchaseData = {
        title,
        bill_type,
        bill_amount: parseFloat(bill_amount),
        outstanding_amount: bill_type === 'credit'
          ? parseFloat(outstanding_amount) || parseFloat(bill_amount)
          : 0,
        paid_amount: bill_type === 'cash'
          ? parseFloat(bill_amount)
          : (parseFloat(paid_amount) || 0),
        bill_file_path: req.file ? `uploads/purchases/${req.file.filename}` : null,
        bill_file_name: req.file ? req.file.originalname : null,
        purchase_date: purchase_date || new Date().toISOString().slice(0, 10),
        notes
      };

      const result = Purchase.create(purchaseData, req.user.id);
      const purchase = Purchase.getById(result.lastInsertRowid);

      res.status(201).json({
        success: true,
        message: 'Purchase created successfully',
        data: formatPurchase(purchase)
      });
    } catch (error) {
      console.error('Create purchase error:', error);
      res.status(500).json({ success: false, error: 'Failed to create purchase' });
    }
  }
];

// Update purchase
exports.updatePurchase = (req, res) => {
  try {
    const { id } = req.params;
    const { title, bill_type, bill_amount, outstanding_amount, paid_amount, notes } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid purchase ID required' });
    }

    if (!title?.trim() || !bill_type || !bill_amount) {
      return res.status(400).json({ success: false, error: 'Title, bill type, and amount are required' });
    }

    const purchaseData = {
      title,
      bill_type,
      bill_amount: parseFloat(bill_amount),
      outstanding_amount: parseFloat(outstanding_amount) || 0,
      paid_amount: parseFloat(paid_amount) || 0,
      notes
    };

    const result = Purchase.update(parseInt(id), purchaseData);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    const purchase = Purchase.getById(id);

    res.json({
      success: true,
      message: 'Purchase updated successfully',
      data: formatPurchase(purchase)
    });
  } catch (error) {
    console.error('Update purchase error:', error);
    res.status(500).json({ success: false, error: 'Failed to update purchase' });
  }
};

// Update payment
exports.updatePayment = (req, res) => {
  try {
    const { id } = req.params;
    const { paid_amount } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid purchase ID required' });
    }

    if (!paid_amount || parseFloat(paid_amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount required' });
    }

    const result = Purchase.updatePayment(parseInt(id), { paid_amount: parseFloat(paid_amount) });

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    const purchase = Purchase.getById(id);

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: formatPurchase(purchase)
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to update payment' });
  }
};

// Delete
exports.deletePurchase = (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid purchase ID required' });
    }

    const result = Purchase.delete(parseInt(id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Delete purchase error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete purchase' });
  }
};

// Stats
exports.getStats = (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const filters = {
      dateFrom: dateFrom?.trim(),
      dateTo: dateTo?.trim()
    };

    const stats = Purchase.getStats(filters);

    res.json({
      success: true,
      data: {
        total_purchases: stats.total_purchases || 0,
        credit_count: stats.credit_count || 0,
        cash_count: stats.cash_count || 0,
        total_amount: parseFloat(stats.total_amount) || 0,
        total_credit: parseFloat(stats.total_credit) || 0,
        total_cash: parseFloat(stats.total_cash) || 0,
        total_outstanding: parseFloat(stats.total_outstanding) || 0,
        total_credit_paid: parseFloat(stats.total_credit_paid) || 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
};

// Serve file
exports.serveFile = (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'purchases', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ success: false, error: 'Failed to serve file' });
  }
};

module.exports.upload = upload;
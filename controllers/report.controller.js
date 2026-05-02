const ReportService = require('../services/report.service');

// ✅ Get today's summary
exports.getTodaySummary = (req, res) => {
  try {
    const summary = ReportService.getTodaySummary();
    res.json({ success: true,  summary });
  } catch (error) {
    console.error('Get today summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch today summary' });
  }
};

// ✅ Get sales report
exports.getSalesReport = (req, res) => {
  try {
    const { dateFrom, dateTo, paymentMethod, cashier, sortBy, order, limit } = req.query;
    
    const filters = {
      dateFrom,
      dateTo,
      paymentMethod,
      cashier,
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };
    
    const report = ReportService.getSalesReport(filters);
    res.json({ success: true,  report });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sales report' });
  }
};

// ✅ Get credit sales report
exports.getCreditSalesReport = (req, res) => {
  try {
    const { dateFrom, dateTo, status, customer, sortBy, order, limit } = req.query;
    
    const filters = {
      dateFrom,
      dateTo,
      status,
      customer,
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };
    
    const report = ReportService.getCreditSalesReport(filters);
    res.json({ success: true,  report });
  } catch (error) {
    console.error('Get credit sales report error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch credit sales report' });
  }
};

// ✅ Get stock report
exports.getStockReport = (req, res) => {
  try {
    const { search, lowStockOnly, company, sortBy, order, limit } = req.query;
    
    const filters = {
      search,
      lowStockOnly: lowStockOnly === 'true',
      company,
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 200
    };
    
    const report = ReportService.getStockReport(filters);
    res.json({ success: true,  report });
  } catch (error) {
    console.error('Get stock report error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stock report' });
  }
};

// ✅ Get expense report
exports.getExpenseReport = (req, res) => {
  try {
    const { dateFrom, dateTo, categoryId, sortBy, order, limit } = req.query;
    
    const filters = {
      dateFrom,
      dateTo,
      categoryId,
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };
    
    const report = ReportService.getExpenseReport(filters);
    res.json({ success: true,  report });
  } catch (error) {
    console.error('Get expense report error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expense report' });
  }
};

// ✅ Get purchase report
exports.getPurchaseReport = (req, res) => {
  try {
    const { dateFrom, dateTo, billType, sortBy, order, limit } = req.query;
    
    const filters = {
      dateFrom,
      dateTo,
      billType,
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };
    
    const report = ReportService.getPurchaseReport(filters);
    res.json({ success: true,  report });
  } catch (error) {
    console.error('Get purchase report error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purchase report' });
  }
};
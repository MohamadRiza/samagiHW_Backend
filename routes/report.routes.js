const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const authenticateToken = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

router.get('/today-summary', reportController.getTodaySummary);
router.get('/sales', reportController.getSalesReport);
router.get('/credit-sales', reportController.getCreditSalesReport);
router.get('/stock', reportController.getStockReport);
router.get('/expenses', reportController.getExpenseReport);
router.get('/purchases', reportController.getPurchaseReport);

module.exports = router;
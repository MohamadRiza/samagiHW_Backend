const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authenticateToken = require('../middleware/auth.middleware');

// ✅ All routes require authentication
router.use(authenticateToken);

// ✅ Routes with proper paths
router.get('/', customerController.getCustomers);
router.get('/search', customerController.searchCustomers); // ✅ /api/customers/search?q=xyz
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer); // ✅ POST /api/customers

module.exports = router;
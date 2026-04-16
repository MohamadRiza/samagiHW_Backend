const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authenticateToken = require('../middleware/auth.middleware');

// ✅ All routes require authentication
router.use(authenticateToken);

// ✅ CRITICAL: Define SPECIFIC routes BEFORE parameterized routes (:id)
// Express matches routes in order - /credit would match /:id if :id comes first!

// --- Specific routes (must come FIRST) ---
router.get('/search', customerController.searchCustomers);
router.get('/credit', customerController.getCreditCustomers); // ✅ NEW: Credit customers list
router.get('/:id/stats', customerController.getCustomerWithStats); // ✅ NEW: Customer stats

// --- General routes (can come after) ---
router.get('/', customerController.getCustomers);
router.post('/', customerController.createCustomer);

// --- Parameterized route MUST COME LAST ---
// This will only match if none of the above specific routes matched
router.get('/:id', customerController.getCustomerById);

module.exports = router;
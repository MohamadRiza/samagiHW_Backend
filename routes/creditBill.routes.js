const express = require('express');
const router = express.Router();
const creditBillController = require('../controllers/creditBill.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

// ✅ All routes require authentication
router.use(authenticateToken);

// ✅ CRITICAL: Define SPECIFIC routes BEFORE parameterized routes (:id)
// Express matches routes in order - /pending would match /:id if :id comes first!

router.get('/paid', authorizeRoles('admin', 'staff'), creditBillController.getPaidBills);


// --- Specific routes (must come FIRST) ---
router.get('/pending', authorizeRoles('admin', 'staff'), creditBillController.getPendingBills);
router.get('/outstanding', authorizeRoles('admin', 'staff'), creditBillController.getOutstandingBills);
router.put('/:billId/payment', authorizeRoles('admin', 'staff'), creditBillController.updateBillPayment);
router.get('/customer/:customerId', authorizeRoles('admin', 'staff'), creditBillController.getCustomerBills);
router.get('/:billId/reprint', authorizeRoles('admin', 'staff'), creditBillController.reprintBill);

// --- General routes (can come after) ---
router.post('/', authorizeRoles('admin', 'staff'), creditBillController.createCreditBill);
router.get('/', authorizeRoles('admin', 'staff'), creditBillController.getCreditBills);

// --- Parameterized route MUST COME LAST ---
// This will only match if none of the above specific routes matched
router.get('/:id', authorizeRoles('admin', 'staff'), creditBillController.getCreditBillById);

module.exports = router;
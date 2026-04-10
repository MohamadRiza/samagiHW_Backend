const express = require('express');
const router = express.Router();
const creditBillController = require('../controllers/creditBill.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('admin', 'staff'), creditBillController.createCreditBill);
router.get('/', authorizeRoles('admin', 'staff'), creditBillController.getCreditBills);
router.get('/outstanding', authorizeRoles('admin', 'staff'), creditBillController.getOutstandingBills);
router.get('/:id', authorizeRoles('admin', 'staff'), creditBillController.getCreditBillById);

module.exports = router;
const express = require('express');
const router = express.Router();
const billController = require('../controllers/bill.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

router.use(authenticateToken);

// Cash billing (admin + staff)
router.post('/', authorizeRoles('admin', 'staff'), billController.createBill);
router.get('/', authorizeRoles('admin', 'staff'), billController.getBills);
router.get('/:id', authorizeRoles('admin', 'staff'), billController.getBillById);

module.exports = router;
const express = require('express');
const router = express.Router();
const chequeController = require('../controllers/cheque.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

router.use(authenticateToken);

// Company autocomplete
router.get('/companies', chequeController.getCompanies);

// Cheque CRUD
router.get('/', chequeController.getCheques);
router.get('/reminders', chequeController.getUpcomingReminders);
router.get('/dashboard', chequeController.getDashboardSummary);
router.get('/:id', chequeController.getChequeById);
router.post('/', authorizeRoles('admin', 'staff'), chequeController.createCheque);
router.put('/:id', authorizeRoles('admin'), chequeController.updateCheque);
router.delete('/:id', authorizeRoles('admin'), chequeController.deleteCheque);

module.exports = router;
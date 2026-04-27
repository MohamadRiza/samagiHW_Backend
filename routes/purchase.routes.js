const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

// All routes require authentication
router.use(authenticateToken);

// Get statistics
router.get('/stats', purchaseController.getStats);

// Get all purchases
router.get('/', purchaseController.getPurchases);

// Get purchase by ID
router.get('/:id', purchaseController.getPurchaseById);

// Create purchase (with file upload)
router.post('/', authorizeRoles('admin', 'staff'), purchaseController.createPurchase);

// Update purchase
router.put('/:id', authorizeRoles('admin'), purchaseController.updatePurchase);

// Update payment (for credit purchases)
router.put('/:id/payment', authorizeRoles('admin', 'staff'), purchaseController.updatePayment);

// Delete purchase
router.delete('/:id', authorizeRoles('admin'), purchaseController.deletePurchase);

// Serve uploaded files
router.get('/uploads/:filename', purchaseController.serveFile);

module.exports = router;
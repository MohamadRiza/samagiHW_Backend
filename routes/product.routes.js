const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

// All routes require authentication
router.use(authenticateToken);

// Public read access for billing (staff can view products)
router.get('/', productController.getProducts);
router.get('/low-stock', productController.getLowStock);
router.get('/:id', productController.getProduct);

// Admin-only write operations
router.post('/', authorizeRoles('admin'), productController.createProduct);
router.put('/:id', authorizeRoles('admin'), productController.updateProduct);
router.delete('/:id', authorizeRoles('admin'), productController.deleteProduct);

// Stock operations (admin + staff with billing permission)
router.post('/deduct-stock', authorizeRoles('admin', 'staff'), productController.deductStock);

module.exports = router;
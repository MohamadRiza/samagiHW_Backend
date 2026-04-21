const express = require('express');
const router = express.Router();
const expenseCategoryController = require('../controllers/expenseCategory.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

router.use(authenticateToken);

router.get('/', expenseCategoryController.getCategories);
router.post('/', authorizeRoles('admin'), expenseCategoryController.createCategory);
router.put('/:id', authorizeRoles('admin'), expenseCategoryController.updateCategory);
router.delete('/:id', authorizeRoles('admin'), expenseCategoryController.deleteCategory);

module.exports = router;
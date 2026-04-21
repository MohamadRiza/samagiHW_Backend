const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authorizeRoles = require('../middleware/role.middleware');

router.use(authenticateToken);

router.get('/', expenseController.getExpenses);
router.get('/total', expenseController.getExpensesTotal);
router.get('/by-category', expenseController.getExpensesByCategory);
router.get('/:id', expenseController.getExpenseById);
router.post('/', authorizeRoles('admin', 'staff'), expenseController.createExpense);
router.put('/:id', authorizeRoles('admin'), expenseController.updateExpense);
router.delete('/:id', authorizeRoles('admin'), expenseController.deleteExpense);

module.exports = router;
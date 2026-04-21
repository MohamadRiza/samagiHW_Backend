const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');

exports.getExpenses = (req, res) => {
  try {
    const { dateFrom, dateTo, categoryId, search, sortBy, order, limit } = req.query;
    
    const filters = {
      dateFrom: dateFrom?.trim(),
      dateTo: dateTo?.trim(),
      categoryId: categoryId ? parseInt(categoryId) : null,
      search: search?.trim(),
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };
    
    const expenses = Expense.getAll(filters);
    
    // Format for frontend
    const formattedExpenses = expenses.map(expense => ({
      ...expense,
      expense_date: new Date(expense.expense_date).toISOString(),
      created_at: new Date(expense.created_at).toISOString()
    }));
    
    res.json({ success: true, data: formattedExpenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
};

exports.getExpenseById = (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid expense ID required' });
    }
    
    const expense = Expense.getById(parseInt(id));
    if (!expense) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    res.json({ 
      success: true, 
      data: {
        ...expense,
        expense_date: new Date(expense.expense_date).toISOString(),
        created_at: new Date(expense.created_at).toISOString()
      } 
    });
  } catch (error) {
    console.error('Get expense by ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expense' });
  }
};

exports.createExpense = (req, res) => {
  try {
    const { reason, amount, category_id, expense_date } = req.body;
    
    if (!reason?.trim() || !amount || !category_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reason, amount, and category are required',
        data: null 
      });
    }
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be a positive number',
        data: null 
      });
    }
    
    // Validate category exists and is active
    const category = ExpenseCategory.getById(category_id);
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid category',
        data: null 
      });
    }
    
    // Use provided date or current time
    const expenseDate = expense_date || new Date().toISOString();
    
    const result = Expense.create({
      reason,
      amount: parsedAmount,
      category_id,
      expense_date: expenseDate
    }, req.user.id);
    
    const expense = Expense.getById(result.lastInsertRowid);
    
    res.status(201).json({ 
      success: true, 
      message: 'Expense created successfully', 
      data: {
        ...expense,
        expense_date: new Date(expense.expense_date).toISOString(),
        created_at: new Date(expense.created_at).toISOString()
      }
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create expense',
      data: null 
    });
  }
};

exports.updateExpense = (req, res) => {
  try {
    const { id } = req.params;
    const { reason, amount, category_id, expense_date } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid expense ID required' });
    }
    
    if (!reason?.trim() || !amount || !category_id) {
      return res.status(400).json({ success: false, error: 'Reason, amount, and category are required' });
    }
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    }
    
    const category = ExpenseCategory.getById(category_id);
    if (!category) {
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }
    
    const result = Expense.update(parseInt(id), {
      reason,
      amount: parsedAmount,
      category_id,
      expense_date: expense_date || new Date().toISOString()
    }, req.user.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    const expense = Expense.getById(id);
    res.json({ 
      success: true, 
      message: 'Expense updated successfully', 
      data: {
        ...expense,
        expense_date: new Date(expense.expense_date).toISOString(),
        created_at: new Date(expense.created_at).toISOString()
      }
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, error: 'Failed to update expense' });
  }
};

exports.deleteExpense = (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid expense ID required' });
    }
    
    const result = Expense.delete(parseInt(id));
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
};

exports.getExpensesTotal = (req, res) => {
  try {
    const { dateFrom, dateTo, categoryId } = req.query;
    
    const filters = {
      dateFrom: dateFrom?.trim(),
      dateTo: dateTo?.trim(),
      categoryId: categoryId ? parseInt(categoryId) : null
    };
    
    const total = Expense.getTotal(filters);
    
    res.json({ 
      success: true, 
      data: { 
        total,
        formatted: `LKR ${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
      } 
    });
  } catch (error) {
    console.error('Get expenses total error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate total' });
  }
};

exports.getExpensesByCategory = (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const filters = {
      dateFrom: dateFrom?.trim(),
      dateTo: dateTo?.trim()
    };
    
    const byCategory = Expense.getByCategory(filters);
    
    res.json({ success: true, data: byCategory });
  } catch (error) {
    console.error('Get expenses by category error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch category breakdown' });
  }
};
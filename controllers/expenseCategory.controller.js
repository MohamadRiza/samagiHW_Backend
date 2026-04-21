const ExpenseCategory = require('../models/ExpenseCategory');

exports.getCategories = (req, res) => {
  try {
    const categories = ExpenseCategory.getAll();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

exports.createCategory = (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Category name must be at least 2 characters' });
    }
    
    const result = ExpenseCategory.create(name, description, color || '#3b82f6');
    const category = ExpenseCategory.getById(result.lastInsertRowid);
    
    res.status(201).json({ 
      success: true, 
      message: 'Category created successfully', 
      data: category 
    });
  } catch (error) {
    console.error('Create category error:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({ success: false, error: 'Category already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
};

exports.updateCategory = (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Category name must be at least 2 characters' });
    }
    
    const result = ExpenseCategory.update(id, name, description, color);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    const category = ExpenseCategory.getById(id);
    res.json({ success: true, message: 'Category updated', data: category });
  } catch (error) {
    console.error('Update category error:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({ success: false, error: 'Category already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
};

exports.deleteCategory = (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category has expenses
    const hasExpenses = db.prepare('SELECT COUNT(*) as count FROM expenses WHERE category_id = ?').get(id);
    if (hasExpenses.count > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete category with existing expenses',
        expenseCount: hasExpenses.count
      });
    }
    
    const result = ExpenseCategory.delete(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
};
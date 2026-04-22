const Cheque = require('../models/Cheque');
const db = require('../config/database'); // make sure this path matches your project

// Get unique companies for autocomplete
exports.getCompanies = (req, res) => {
  try {
    const companies = Cheque.getUniqueCompanies();
    res.json({ success: true, companies });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch companies' });
  }
};

// Get cheques with filters
exports.getCheques = (req, res) => {
  try {
    const { company, type, status, dateFrom, dateTo, search, sortBy, order, limit } = req.query;

    const filters = {
      company: company?.trim(),
      type,
      status,
      dateFrom: dateFrom?.trim(),
      dateTo: dateTo?.trim(),
      search: search?.trim(),
      sortBy,
      order,
      limit: limit ? parseInt(limit) : 100
    };

    const cheques = Cheque.getAll(filters);

    const formattedCheques = cheques.map(cheque => ({
      ...cheque,
      cheque_date: new Date(cheque.cheque_date).toISOString().slice(0, 10),
      remind_date: cheque.remind_date
        ? new Date(cheque.remind_date).toISOString().slice(0, 10)
        : null,
      created_at: new Date(cheque.created_at).toISOString()
    }));

    res.json({ success: true, data: formattedCheques });
  } catch (error) {
    console.error('Get cheques error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cheques' });
  }
};

// Get cheque by ID
exports.getChequeById = (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid cheque ID required' });
    }

    const cheque = Cheque.getById(parseInt(id));

    if (!cheque) {
      return res.status(404).json({ success: false, error: 'Cheque not found' });
    }

    res.json({
      success: true,
      data: {
        ...cheque,
        cheque_date: new Date(cheque.cheque_date).toISOString().slice(0, 10),
        remind_date: cheque.remind_date
          ? new Date(cheque.remind_date).toISOString().slice(0, 10)
          : null,
        created_at: new Date(cheque.created_at).toISOString()
      }
    });
  } catch (error) {
    console.error('Get cheque by ID error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cheque' });
  }
};

// Create cheque
exports.createCheque = (req, res) => {
  try {
    const { company_name, cheque_number, amount, cheque_date, type, status, notes } = req.body;

    if (!company_name?.trim() || !cheque_number?.trim() || !amount || !cheque_date || !type) {
      return res.status(400).json({
        success: false,
        error: 'Company, cheque number, amount, date, and type are required'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    const existing = db.prepare(
      'SELECT id FROM cheques WHERE cheque_number = ?'
    ).get(cheque_number.trim());

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Cheque number must be unique'
      });
    }

    const result = Cheque.create({
      company_name,
      cheque_number,
      amount: parsedAmount,
      cheque_date,
      type,
      status: status || 'pending',
      notes
    }, req.user.id);

    const cheque = Cheque.getById(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Cheque created successfully',
      data: {
        ...cheque,
        cheque_date: new Date(cheque.cheque_date).toISOString().slice(0, 10),
        remind_date: cheque.remind_date
          ? new Date(cheque.remind_date).toISOString().slice(0, 10)
          : null,
        created_at: new Date(cheque.created_at).toISOString()
      }
    });
  } catch (error) {
    console.error('Create cheque error:', error);

    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({
        success: false,
        error: 'Cheque number already exists'
      });
    }

    res.status(500).json({ success: false, error: 'Failed to create cheque' });
  }
};

// Update cheque
exports.updateCheque = (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, cheque_number, amount, cheque_date, type, status, notes } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid cheque ID required' });
    }

    if (!company_name?.trim() || !cheque_number?.trim() || !amount || !cheque_date || !type) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    }

    const existing = db.prepare(
      'SELECT id FROM cheques WHERE cheque_number = ? AND id != ?'
    ).get(cheque_number.trim(), parseInt(id));

    if (existing) {
      return res.status(400).json({ success: false, error: 'Cheque number already exists' });
    }

    const result = Cheque.update(parseInt(id), {
      company_name,
      cheque_number,
      amount: parsedAmount,
      cheque_date,
      type,
      status,
      notes
    }, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Cheque not found' });
    }

    const cheque = Cheque.getById(parseInt(id));

    res.json({
      success: true,
      message: 'Cheque updated successfully',
      data: {
        ...cheque,
        cheque_date: new Date(cheque.cheque_date).toISOString().slice(0, 10),
        remind_date: cheque.remind_date
          ? new Date(cheque.remind_date).toISOString().slice(0, 10)
          : null,
        created_at: new Date(cheque.created_at).toISOString()
      }
    });
  } catch (error) {
    console.error('Update cheque error:', error);

    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({
        success: false,
        error: 'Cheque number already exists'
      });
    }

    res.status(500).json({ success: false, error: 'Failed to update cheque' });
  }
};

// Delete cheque
exports.deleteCheque = (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ success: false, error: 'Valid cheque ID required' });
    }

    const result = Cheque.delete(parseInt(id));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Cheque not found' });
    }

    res.json({ success: true, message: 'Cheque deleted successfully' });
  } catch (error) {
    console.error('Delete cheque error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete cheque' });
  }
};

// Get upcoming reminders
exports.getUpcomingReminders = (req, res) => {
  try {
    const reminders = Cheque.getUpcomingReminders();

    const formatted = reminders.map(reminder => ({
      ...reminder,
      cheque_date: new Date(reminder.cheque_date).toISOString().slice(0, 10),
      remind_date: reminder.remind_date
        ? new Date(reminder.remind_date).toISOString().slice(0, 10)
        : null,
      days_until_due: parseInt(reminder.days_until_due)
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reminders' });
  }
};

// Dashboard summary
exports.getDashboardSummary = (req, res) => {
  try {
    const summary = Cheque.getDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
};
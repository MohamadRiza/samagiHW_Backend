require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Set app version for update comparison (update with each release!)
process.env.APP_VERSION = process.env.APP_VERSION || '1.0.0';
process.env.GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-username';
process.env.GITHUB_REPO = process.env.GITHUB_REPO || 'pos-system';
process.env.GITHUB_BACKEND_REPO = process.env.GITHUB_BACKEND_REPO || 'pos-system-backend';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Initialize ALL database tables on startup
const initializeTables = () => {
  try {
    // Bills
    const Bill = require('./models/Bill');
    Bill.init();
    
    // Customers & Credit Bills
    const Customer = require('./models/Customer');
    const CreditBill = require('./models/CreditBill');
    Customer.init();
    CreditBill.init();
    
    // Expenses
    const ExpenseCategory = require('./models/ExpenseCategory');
    const Expense = require('./models/Expense');
    ExpenseCategory.init();
    Expense.init();
    
    // Cheques
    const Cheque = require('./models/Cheque');
    Cheque.init();
    
    // Purchases
    const Purchase = require('./models/Purchase');
    Purchase.init();
    
    // ✅ Create backups directory if not exists
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('📁 Backup directory created');
    }
    
    console.log('✅ All database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize tables:', error);
  }
};

initializeTables();

// ✅ Auto-check for updates on startup (admin notification)
const checkUpdatesOnStartup = async () => {
  if (process.env.AUTO_CHECK_UPDATES !== 'true') return;
  
  try {
    const UpdateService = require('./services/update.service');
    const result = await UpdateService.checkForUpdates();
    
    if (result?.success && result.data?.hasUpdate) {
      console.log(`\n🔄 UPDATE AVAILABLE: v${result.data.currentVersion} → v${result.data.latestVersion}`);
      console.log(`📝 ${result.data.releaseName || 'New version'}`);
      console.log(`🔗 Release: ${result.data.releaseNotes?.split('\n')[0] || 'Check GitHub for details'}\n`);
    }
  } catch (error) {
    // Silent fail - don't block app startup
    console.log('ℹ️  Update check skipped (offline or error)');
  }
};

// API Routes (component-based mounting)
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/bills', require('./routes/bill.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/credit-bills', require('./routes/creditBill.routes'));
app.use('/api/expense-categories', require('./routes/expenseCategory.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/cheques', require('./routes/cheque.routes'));
app.use('/api/purchases', require('./routes/purchase.routes'));
app.use('/api/reports', require('./routes/report.routes'));


// ✅ Settings & Update routes
app.use('/api/settings', require('./routes/settings.routes'));

// ✅ Serve uploaded files
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Health check with version info
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'POS Backend Running',
    version: process.env.APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

// ✅ Serve frontend in production (for Electron bundling)
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    
    // Handle React Router history mode - exclude API routes
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
    console.log('🌐 Frontend served from:', frontendPath);
  }
}

// ✅ FIXED: Catch undefined API routes (using regex pattern compatible with path-to-regexp)
app.all(/^\/api\/.+/, (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found', 
    path: req.path,
    hint: 'Check the API documentation for available endpoints'
  });
});

// ✅ Global error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max 10MB.' });
  }
  
  // Handle database errors
  if (err.message?.includes('SQLITE')) {
    return res.status(500).json({ 
      error: 'Database error', 
      message: 'Please contact support if this persists' 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`\n🚀 POS Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 App Version: ${process.env.APP_VERSION}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api\n`);
  
  // Check for updates after server is ready
  checkUpdatesOnStartup();
});

// ✅ Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});


module.exports = app;
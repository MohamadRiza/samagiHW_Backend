require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes (component-based)
const authRoutes = require('./routes/auth.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize bills table on startup
const Bill = require('./models/Bill');
Bill.init();

// Initialize tables on startup
const Customer = require('./models/Customer');
const CreditBill = require('./models/CreditBill');
Customer.init();
CreditBill.init();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes (component-based mounting)
app.use('/api/auth', authRoutes);
// app.use('/api/products', require('./routes/product.routes'));
// app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/bills', require('./routes/bill.routes'));
app.use('/api/customers', require('./routes/customer.routes'));
app.use('/api/credit-bills', require('./routes/creditBill.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'POS Backend Running' });
});

// Serve frontend in production (optional for Electron)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 POS Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});
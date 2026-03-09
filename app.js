require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 to prevent Nodemailer ENETUNREACH on Render
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/database');
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const petRoutes = require('./routes/pets');
const healthRoutes = require('./routes/health');
const reminderRoutes = require('./routes/reminders');
const vetRoutes = require('./routes/vets');
const expenseRoutes = require('./routes/expenses');
const aiRoutes = require('./routes/ai');
const vaultRoutes = require('./routes/vault');
const publicRoutes = require('./routes/public');
const marketplaceRoutes = require('./routes/marketplace');
const amazonRoutes = require('./routes/amazon');
const weightRoutes = require('./routes/weight');
const walkRoutes = require('./routes/walk');


// Initialize express app
const app = express();

// Trust proxy for Render load balancers (fixes express-rate-limit error)
app.set('trust proxy', 1);

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public Routes (Mounted at root for QR codes)
app.use('/', publicRoutes);
app.get('/test-scan', (req, res) => res.send('Scan route reached!'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/vets', vetRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/amazon', amazonRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/walks', walkRoutes);


// Health check route
app.get('/api/health-check', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'PetCare Hub API is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.env} mode on port ${PORT}`);
});

module.exports = app;

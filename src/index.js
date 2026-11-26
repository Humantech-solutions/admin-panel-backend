const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const path = require('path');

const app = express();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const careerRoutes = require('./routes/careerRoutes');
const contactRoutes = require('./routes/contactRoutes');
const eventRegistrationRoutes = require('./routes/eventRegistrationRoutes');
const salesRoutes = require('./routes/salesRoutes');
const chatRoutes = require('./routes/chatRoutes');
const companyRoutes = require('./routes/companyRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const documentRequestRoutes = require('./routes/documentRequestRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const seedDefaults = require('./utils/seeder');

// Configure CORS options
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://admin.hutechsolutions.ai',
      'https://admin.hutechsolutions.in',
      'https://apis.admin.hutechsolutions.in',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:8000',
      'http://localhost:8001'
    ];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman) or matching origins
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Pass true to prevent blocking requests from unknown origins in production
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Fallback if an uploaded attachment is not found on disk
app.use('/uploads', (req, res) => {
  res.status(404).json({
    success: false,
    message: `File '${req.path.replace(/^\//, '')}' is not found on server storage. It may have been cleared during an earlier container deployment before persistent volumes were configured.`,
    path: req.path
  });
});
app.use(express.static(path.join(__dirname, '../public')));

// Public CRM Embed Script
app.get('/crm-embed.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(path.join(__dirname, '../public/crm-embed.js'));
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/event-registration', eventRegistrationRoutes);
app.use('/api/event', eventRegistrationRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/documents', documentRequestRoutes);
app.use('/api/document', documentRequestRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Root API Health Check
app.get('/', (req, res) => {
  const adminUrl = process.env.ADMIN_URL || 'https://admin.hutechsolutions.in';
  res.json({
    status: 'ok',
    service: 'SahajCRM Backend API 🚀',
    docs: `${adminUrl}/docs`
  });
});

// Documentation Route — Redirect to Next.js Documentation
app.get('/docs', (req, res) => {
  const adminUrl = process.env.ADMIN_URL || 'https://admin.hutechsolutions.in';
  res.redirect(`${adminUrl}/docs`);
});

// Database connection with automatic local fallback
const primaryMongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sahajCRM';
const fallbackMongoURI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/sahajCRM';

async function connectDatabase() {
  try {
    await mongoose.connect(primaryMongoURI, {
      serverSelectionTimeoutMS: 4000
    });
    console.log(`✅ MongoDB connected successfully`);
    await seedDefaults();
    const { startPolling } = require('./utils/blogPollingService');
    startPolling();
  } catch (err) {
    console.error('❌ MongoDB primary connection error:', err.message);
    if (primaryMongoURI !== fallbackMongoURI) {
      console.log('🔄 Attempting fallback connection to local MongoDB:', fallbackMongoURI);
      try {
        await mongoose.connect(fallbackMongoURI, {
          serverSelectionTimeoutMS: 4000
        });
        console.log('✅ MongoDB connected successfully to fallback local database (sahajCRM)');
        await seedDefaults();
        const { startPolling } = require('./utils/blogPollingService');
        startPolling();
      } catch (fallbackErr) {
        console.error('❌ MongoDB fallback connection error:', fallbackErr.message);
      }
    }
  }
}

connectDatabase();

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

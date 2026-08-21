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
const seedDefaults = require('./utils/seeder');

// Configure CORS options
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://admin.hutechsolutions.in',
      'https://apis.admin.hutechsolutions.in',
      'http://localhost:3000',
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/event-registration', eventRegistrationRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/documents', documentRequestRoutes);

app.get('/', (req, res) => {
  res.send('API running 🚀');
});

// Database connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nabhira_db';
mongoose.connect(mongoURI)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    await seedDefaults();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));


const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
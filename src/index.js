const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const careerRoutes = require('./routes/careerRoutes');
const contactRoutes = require('./routes/contactRoutes');
const eventRegistrationRoutes = require('./routes/eventRegistrationRoutes');
const salesRoutes = require('./routes/salesRoutes');
const chatRoutes = require('./routes/chatRoutes');

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/event-registration', eventRegistrationRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
  res.send('API running 🚀');
});

// Database connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nabhira_db';
mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));


const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint (no DB required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database initialization endpoint (one-time use)
app.post('/api/init-db', async (req, res) => {
  try {
    const fs = require('fs');
    const { pool } = require('./src/db');
    const schemaPath = path.join(__dirname, 'src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    res.json({ status: 'ok', message: 'Database initialized successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/buy', require('./src/routes/buy'));
app.use('/api/sell', require('./src/routes/sell'));
app.use('/api/update', require('./src/routes/update'));
app.use('/api/pipeline', require('./src/routes/pipeline'));
app.use('/api/companies', require('./src/routes/companies'));
app.use('/api/partners', require('./src/routes/partners'));
app.use('/api/issuers', require('./src/routes/issuers'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/changelog', require('./src/routes/changelog'));
app.use('/api/logos', require('./src/routes/logos'));
app.use('/api/auto-update', require('./src/routes/auto-update'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const filePath = path.join(__dirname, 'public', req.path);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

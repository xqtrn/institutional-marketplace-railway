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

// Create admin user endpoint (one-time use)
app.post('/api/init-admin', async (req, res) => {
  const API_SECRET = process.env.API_SECRET || 'investclub-admin-secure-key-2024';
  const authHeader = req.headers['x-api-key'];
  if (!authHeader || authHeader !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { pool } = require('./src/db');
  const CryptoJS = require('crypto-js');
  const SALT = 'im_salt_2024';

  const { email, password, role, permissions } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const passwordHash = CryptoJS.SHA256(password + SALT).toString();
    const perms = permissions || (role === 'super_admin' ? [] : []);
    await pool.query(
      `INSERT INTO users (email, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3, permissions = $4`,
      [email.toLowerCase(), passwordHash, role || 'super_admin', JSON.stringify(perms)]
    );
    res.json({ success: true, message: `User ${email} created with role ${role || 'super_admin'}` });
  } catch (error) {
    console.error('Init admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Migration endpoint for bulk data import
app.post('/api/migrate', async (req, res) => {
  const API_SECRET = process.env.API_SECRET || 'investclub-admin-secure-key-2024';
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { pool } = require('./src/db');
  const { table, data } = req.body;

  if (!table || !data) {
    return res.status(400).json({ error: 'table and data required' });
  }

  try {
    let imported = 0;

    if (table === 'deals') {
      for (const deal of data) {
        await pool.query(
          `INSERT INTO deals (deal_type, company, price, volume, valuation, structure, share_class, series, management_fee, carry, partner, partner_id, source, status, last_update)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
           ON CONFLICT DO NOTHING`,
          [
            deal.deal_type,
            deal.company,
            deal.price || null,
            deal.volume || null,
            deal.valuation || null,
            deal.structure || null,
            deal.shareClass || deal.share_class || null,
            deal.series || null,
            deal.managementFee || deal.management_fee || 0,
            deal.carry || 0,
            deal.partner || null,
            deal.partnerId || deal.partner_id || null,
            deal.source || 'manual',
            deal.status || 'active'
          ]
        );
        imported++;
      }
    } else if (table === 'partners') {
      for (const partner of data) {
        await pool.query(
          `INSERT INTO partners (name, data) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [partner.name || partner.Name, JSON.stringify(partner)]
        );
        imported++;
      }
    } else if (table === 'companies') {
      for (const company of data) {
        await pool.query(
          `INSERT INTO companies (name, data) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [company.name || company.Name, JSON.stringify(company)]
        );
        imported++;
      }
    } else if (table === 'settings') {
      for (const [key, value] of Object.entries(data)) {
        await pool.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, JSON.stringify(value)]
        );
        imported++;
      }
    } else if (table === 'logos') {
      for (const [company, url] of Object.entries(data)) {
        await pool.query(
          `INSERT INTO logos (company, url) VALUES ($1, $2) ON CONFLICT (company) DO UPDATE SET url = $2`,
          [company, url]
        );
        imported++;
      }
    } else if (table === 'users') {
      const CryptoJS = require('crypto-js');
      const SALT = 'im_salt_2024';
      for (const user of data) {
        const passwordHash = CryptoJS.SHA256(user.password + SALT).toString();
        await pool.query(
          `INSERT INTO users (email, password_hash, role, permissions) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3, permissions = $4`,
          [user.email.toLowerCase(), passwordHash, user.role || 'user', JSON.stringify(user.permissions || [])]
        );
        imported++;
      }
    }

    res.json({ status: 'ok', imported });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message });
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

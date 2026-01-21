const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

router.get('/', async (req, res) => {
  try {
    // Try to get from database first
    const result = await pool.query('SELECT * FROM issuers ORDER BY name');

    if (result.rows.length > 0) {
      const issuers = result.rows.map(row => ({
        id: row.id,
        ticker: row.ticker,
        name: row.name,
        ...row.data
      }));
      return res.json(issuers);
    }

    // Fallback to static file
    const staticPath = path.join(__dirname, '../../public/api/issuers-all.json');
    if (fs.existsSync(staticPath)) {
      const data = fs.readFileSync(staticPath, 'utf8');
      return res.json(JSON.parse(data));
    }

    res.json([]);
  } catch (error) {
    console.error('Issuers GET error:', error);
    res.status(500).json({ error: 'Failed to fetch issuers' });
  }
});

router.post('/', validateApiKey, async (req, res) => {
  try {
    const issuers = req.body.data || req.body;

    if (!Array.isArray(issuers)) {
      return res.status(400).json({ error: 'Data must be an array' });
    }

    await pool.query('DELETE FROM issuers');

    for (const issuer of issuers) {
      const { ticker, name, ...data } = issuer;
      await pool.query(
        'INSERT INTO issuers (ticker, name, data) VALUES ($1, $2, $3)',
        [ticker || null, name || issuer.company || 'Unknown', data]
      );
    }

    res.json({ success: true, count: issuers.length });
  } catch (error) {
    console.error('Issuers POST error:', error);
    res.status(500).json({ error: 'Failed to update issuers' });
  }
});

module.exports = router;

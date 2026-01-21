const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT company, url FROM logos');

    if (result.rows.length > 0) {
      const logos = {};
      for (const row of result.rows) {
        logos[row.company] = row.url;
      }
      return res.json(logos);
    }

    // Fallback to static file
    const staticPath = path.join(__dirname, '../../public/api/logos.json');
    if (fs.existsSync(staticPath)) {
      const data = fs.readFileSync(staticPath, 'utf8');
      return res.json(JSON.parse(data));
    }

    res.json({});
  } catch (error) {
    console.error('Logos GET error:', error);
    res.status(500).json({ error: 'Failed to fetch logos' });
  }
});

router.post('/', validateApiKey, async (req, res) => {
  try {
    const logos = req.body;

    if (typeof logos !== 'object') {
      return res.status(400).json({ error: 'Data must be an object' });
    }

    await pool.query('DELETE FROM logos');

    for (const [company, url] of Object.entries(logos)) {
      await pool.query(
        'INSERT INTO logos (company, url) VALUES ($1, $2)',
        [company, url]
      );
    }

    res.json({ success: true, count: Object.keys(logos).length });
  } catch (error) {
    console.error('Logos POST error:', error);
    res.status(500).json({ error: 'Failed to update logos' });
  }
});

module.exports = router;

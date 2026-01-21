const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies ORDER BY id');
    const companies = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      ...row.data
    }));
    // Match Cloudflare response format
    res.json({ success: true, count: companies.length, companies });
  } catch (error) {
    console.error('Companies GET error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

router.post('/', validateApiKey, async (req, res) => {
  try {
    const companies = req.body.data || req.body;

    if (!Array.isArray(companies)) {
      return res.status(400).json({ error: 'Data must be an array' });
    }

    // Clear and replace
    await pool.query('DELETE FROM companies');

    for (const company of companies) {
      const { name, ...data } = company;
      await pool.query(
        'INSERT INTO companies (name, data) VALUES ($1, $2)',
        [name || data.company || 'Unknown', data]
      );
    }

    res.json({ success: true, count: companies.length });
  } catch (error) {
    console.error('Companies POST error:', error);
    res.status(500).json({ error: 'Failed to update companies' });
  }
});

module.exports = router;

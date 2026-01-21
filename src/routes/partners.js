const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM partners ORDER BY name');
    const partners = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      ...row.data
    }));
    res.json(partners);
  } catch (error) {
    console.error('Partners GET error:', error);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

router.post('/', validateApiKey, async (req, res) => {
  try {
    const partners = req.body.data || req.body;

    if (!Array.isArray(partners)) {
      return res.status(400).json({ error: 'Data must be an array' });
    }

    await pool.query('DELETE FROM partners');

    for (const partner of partners) {
      const { name, ...data } = partner;
      await pool.query(
        'INSERT INTO partners (name, data) VALUES ($1, $2)',
        [name || data.partner || 'Unknown', data]
      );
    }

    res.json({ success: true, count: partners.length });
  } catch (error) {
    console.error('Partners POST error:', error);
    res.status(500).json({ error: 'Failed to update partners' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'display_settings'");

    if (result.rows.length === 0) {
      return res.json({
        currency: 'USD',
        dateFormat: 'MMM D, YYYY',
        numberFormat: 'en-US',
        showDecimals: false,
        highlightThreshold: 1000000
      });
    }

    res.json(result.rows[0].value);
  } catch (error) {
    console.error('Settings GET error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/', validateApiKey, async (req, res) => {
  try {
    const settings = req.body;

    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('display_settings', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(settings)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Settings POST error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

router.put('/', validateApiKey, async (req, res) => {
  try {
    const settings = req.body;

    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('display_settings', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(settings)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Settings PUT error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;

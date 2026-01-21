const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await pool.query(
      'SELECT * FROM changelog ORDER BY created_at DESC LIMIT $1',
      [Math.min(limit, 500)]
    );

    const changelog = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at?.toISOString(),
      action: row.action,
      type: row.deal_type,
      dealId: row.deal_id,
      company: row.company,
      previousData: row.previous_data,
      newData: row.new_data,
      count: row.new_data?.count
    }));

    res.json(changelog);
  } catch (error) {
    console.error('Changelog GET error:', error);
    res.status(500).json({ error: 'Failed to fetch changelog' });
  }
});

module.exports = router;

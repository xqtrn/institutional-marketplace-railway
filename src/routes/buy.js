const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deals WHERE deal_type = $1 ORDER BY last_update DESC',
      ['buy']
    );

    // Transform to match old format
    const deals = result.rows.map(row => ({
      id: row.id.toString(),
      company: row.company,
      price: row.price,
      volume: row.volume,
      valuation: row.valuation,
      structure: row.structure,
      shareClass: row.share_class,
      series: row.series,
      managementFee: parseFloat(row.management_fee) || 0,
      carry: parseFloat(row.carry) || 0,
      partner: row.partner,
      partnerId: row.partner_id,
      lastUpdate: row.last_update?.toISOString(),
      source: row.source,
      status: row.status
    }));

    res.json(deals);
  } catch (error) {
    console.error('Error fetching buy deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

module.exports = router;

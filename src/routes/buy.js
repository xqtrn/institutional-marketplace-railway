const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Format date as "November 17, 2025"
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deals WHERE deal_type = $1 ORDER BY last_update DESC',
      ['buy']
    );

    // Transform to match Cloudflare format exactly
    const deals = result.rows.map(row => ({
      id: row.id,
      company: row.company,
      price: row.price || 'Request',
      volume: row.volume || 'Request',
      valuation: row.valuation || 'Request',
      structure: row.structure || 'Direct Trade',
      shareClass: row.share_class || 'Common',
      series: row.series || '',
      managementFee: row.management_fee || '',
      carry: row.carry || '',
      partner: row.partner || '',
      partnerId: row.partner_id || '',
      lastUpdate: formatDate(row.last_update),
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

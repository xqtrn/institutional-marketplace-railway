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
      'SELECT * FROM deals WHERE deal_type = $1 ORDER BY id ASC',
      ['sell']
    );

    // Transform to match Cloudflare format exactly - keep original values
    const deals = result.rows.map((row, index) => ({
      id: index + 1,  // Sequential IDs starting from 1
      company: row.company,
      managementFee: row.management_fee === 0 || row.management_fee === null ? '' : row.management_fee,
      carry: row.carry === 0 || row.carry === null ? '' : row.carry,
      lastUpdate: formatDate(row.last_update),
      volume: row.volume || 'Request',
      price: row.price || 'Request',
      valuation: row.valuation || 'Request',
      structure: row.structure || 'Direct Trade',
      shareClass: row.share_class || 'Common'
    }));

    res.json(deals);
  } catch (error) {
    console.error('Error fetching sell deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

module.exports = router;

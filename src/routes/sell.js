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

// Parse value to match Cloudflare format: numbers as numbers, null for missing
function parseValue(val) {
  if (!val || val === '' || val === 'Request' || val === 'null') return null;
  // If it's a formatted string like "$5M", keep as string
  if (typeof val === 'string' && (val.includes('$') || val.includes('M') || val.includes('B') || val.includes('K'))) {
    return val;
  }
  // Try to parse as number
  const num = parseFloat(val);
  if (!isNaN(num)) return num;
  return val;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deals WHERE deal_type = $1 ORDER BY last_update DESC',
      ['sell']
    );

    // Transform to match Cloudflare format exactly
    const deals = result.rows.map(row => ({
      id: row.id.toString(),
      company: row.company,
      price: parseValue(row.price),
      volume: parseValue(row.volume),
      valuation: parseValue(row.valuation),
      structure: row.structure || 'Direct Trade',
      shareClass: row.share_class || 'Common',
      series: row.series || '',
      managementFee: parseFloat(row.management_fee) || 0,
      carry: parseFloat(row.carry) || 0,
      partner: row.partner || '',
      partnerId: row.partner_id || '',
      lastUpdate: formatDate(row.last_update),
      source: row.source,
      status: row.status
    }));

    res.json(deals);
  } catch (error) {
    console.error('Error fetching sell deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

module.exports = router;

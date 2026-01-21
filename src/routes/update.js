const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');

// Parse date string like "November 17, 2025" to Date object
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  // If already a valid ISO date
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) return isoDate;
  // Parse "Month Day, Year" format
  const months = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
                   July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
  const match = dateStr.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return new Date(parseInt(year), months[month] || 0, parseInt(day));
  }
  return new Date();
}

router.post('/', validateApiKey, async (req, res) => {
  try {
    const body = req.body;
    const dealType = body.type;
    const action = body.action || 'update';

    if (!dealType || !['buy', 'sell'].includes(dealType)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    // Handle DELETE action
    if (action === 'delete') {
      if (!body.id) {
        return res.status(400).json({ error: 'ID required for delete' });
      }

      const deleteResult = await pool.query(
        'DELETE FROM deals WHERE id = $1 AND deal_type = $2 RETURNING *',
        [body.id, dealType]
      );

      if (deleteResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      // Log to changelog
      await pool.query(
        'INSERT INTO changelog (action, deal_type, deal_id, company, previous_data) VALUES ($1, $2, $3, $4, $5)',
        ['delete', dealType, body.id, deleteResult.rows[0].company, JSON.stringify(deleteResult.rows[0])]
      );

      return res.json({
        success: true,
        action: 'delete',
        deletedId: body.id
      });
    }

    // Handle ADD (single deal) action
    if (action === 'add' || (body.company && !body.data)) {
      if (!body.company) {
        return res.status(400).json({ error: 'Company required for add action' });
      }

      // Check for duplicate
      const existingResult = await pool.query(
        `SELECT * FROM deals WHERE deal_type = $1
         AND LOWER(company) = LOWER($2)
         AND LOWER(COALESCE(partner, '')) = LOWER($3)`,
        [dealType, body.company, body.partner || '']
      );

      if (existingResult.rows.length > 0) {
        // Update existing deal
        const existing = existingResult.rows[0];
        await pool.query(
          `UPDATE deals SET
            price = COALESCE($1, price),
            volume = COALESCE($2, volume),
            valuation = COALESCE($3, valuation),
            last_update = NOW()
          WHERE id = $4`,
          [body.price, body.volume, body.valuation, existing.id]
        );

        return res.json({
          success: true,
          message: 'Deal updated (duplicate detected)',
          deduplicated: true
        });
      }

      // Insert new deal
      const insertResult = await pool.query(
        `INSERT INTO deals (deal_type, company, price, volume, valuation, structure, share_class, series, management_fee, carry, partner, partner_id, source, status, last_update)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         RETURNING *`,
        [
          dealType,
          body.company,
          body.price || null,
          body.volume || null,
          body.valuation || null,
          body.structure || 'Direct Trade',
          body.shareClass || 'Common',
          body.series || '',
          body.managementFee || 0,
          body.carry || 0,
          body.partner || '',
          body.partnerId || '',
          'mailai',
          'active'
        ]
      );

      const newDeal = insertResult.rows[0];

      // Log to changelog
      await pool.query(
        'INSERT INTO changelog (action, deal_type, deal_id, company, new_data) VALUES ($1, $2, $3, $4, $5)',
        ['create', dealType, newDeal.id, newDeal.company, JSON.stringify(newDeal)]
      );

      // Auto-sync to Pipeline
      const pipelineCheck = await pool.query(
        `SELECT id FROM pipeline WHERE LOWER(company) = LOWER($1) AND LOWER(COALESCE(partner, '')) = LOWER($2)`,
        [newDeal.company, newDeal.partner || '']
      );

      if (pipelineCheck.rows.length === 0) {
        const pipelineResult = await pool.query(
          `INSERT INTO pipeline (company, deal_type, stage, price, volume, valuation, structure, share_class, partner, probability, source, source_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            newDeal.company,
            dealType,
            'new_lead',
            newDeal.price,
            newDeal.volume,
            newDeal.valuation,
            newDeal.structure,
            newDeal.share_class,
            newDeal.partner,
            20,
            'mailai',
            newDeal.id
          ]
        );

        // Log pipeline creation
        await pool.query(
          'INSERT INTO pipeline_history (deal_id, action, to_stage, trigger) VALUES ($1, $2, $3, $4)',
          [pipelineResult.rows[0].id, 'created', 'new_lead', 'auto_sync']
        );
      }

      return res.json({
        success: true,
        message: 'Deal added successfully',
        deal: {
          id: newDeal.id.toString(),
          company: newDeal.company
        }
      });
    }

    // Handle UPDATE (bulk replace) action
    if (!Array.isArray(body.data)) {
      return res.status(400).json({ error: 'Data must be an array' });
    }

    // Delete all existing deals of this type
    await pool.query('DELETE FROM deals WHERE deal_type = $1', [dealType]);

    // Insert all new deals
    for (const deal of body.data) {
      await pool.query(
        `INSERT INTO deals (deal_type, company, price, volume, valuation, structure, share_class, series, management_fee, carry, partner, partner_id, source, status, last_update)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          dealType,
          deal.company,
          deal.price || null,
          deal.volume || null,
          deal.valuation || null,
          deal.structure || 'Direct Trade',
          deal.shareClass || 'Common',
          deal.series || '',
          deal.managementFee || 0,
          deal.carry || 0,
          deal.partner || '',
          deal.partnerId || '',
          deal.source || 'manual',
          deal.status || 'active',
          parseDate(deal.lastUpdate)
        ]
      );
    }

    // Log to changelog
    await pool.query(
      'INSERT INTO changelog (action, deal_type, new_data) VALUES ($1, $2, $3)',
      ['bulk_update', dealType, JSON.stringify({ count: body.data.length })]
    );

    res.json({ success: true, count: body.data.length });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update data', details: error.message });
  }
});

module.exports = router;

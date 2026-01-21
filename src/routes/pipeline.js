const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey, VALID_API_KEYS } = require('../middleware/auth');

// GET - List all pipeline deals or single deal
router.get('/:id?', async (req, res) => {
  try {
    const { id } = req.params;

    if (id) {
      // Get single deal with history
      const dealResult = await pool.query('SELECT * FROM pipeline WHERE id = $1', [id]);
      if (dealResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const historyResult = await pool.query(
        'SELECT * FROM pipeline_history WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 50',
        [id]
      );

      const deal = dealResult.rows[0];
      return res.json({
        deal: {
          id: deal.id.toString(),
          company: deal.company,
          dealType: deal.deal_type,
          stage: deal.stage,
          price: deal.price,
          volume: deal.volume,
          valuation: deal.valuation,
          structure: deal.structure,
          shareClass: deal.share_class,
          partner: deal.partner,
          partnerEmail: deal.partner_email,
          probability: deal.probability,
          notes: deal.notes,
          source: deal.source,
          sourceId: deal.source_id?.toString(),
          emailThreads: deal.email_threads || [],
          createdAt: deal.created_at?.toISOString(),
          updatedAt: deal.updated_at?.toISOString()
        },
        history: historyResult.rows.map(h => ({
          id: h.id.toString(),
          dealId: h.deal_id.toString(),
          action: h.action,
          fromStage: h.from_stage,
          toStage: h.to_stage,
          field: h.field,
          oldValue: h.old_value,
          newValue: h.new_value,
          trigger: h.trigger,
          timestamp: h.created_at?.toISOString()
        }))
      });
    }

    // Get all deals
    const result = await pool.query('SELECT * FROM pipeline ORDER BY updated_at DESC');

    const deals = result.rows.map(row => ({
      id: row.id.toString(),
      company: row.company,
      dealType: row.deal_type,
      stage: row.stage,
      price: row.price,
      volume: row.volume,
      valuation: row.valuation,
      structure: row.structure,
      shareClass: row.share_class,
      partner: row.partner,
      partnerEmail: row.partner_email,
      probability: row.probability,
      notes: row.notes,
      source: row.source,
      sourceId: row.source_id?.toString(),
      emailThreads: row.email_threads || [],
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString()
    }));

    res.json(deals);
  } catch (error) {
    console.error('Pipeline GET error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// Middleware to validate API key for write operations
function optionalApiKey(req, res, next) {
  const headerKey = req.headers['x-api-key'];
  const bodyKey = req.body?.apiKey;
  const apiKey = headerKey || bodyKey;

  if (apiKey && !VALID_API_KEYS.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// POST - Create new deal
router.post('/', optionalApiKey, async (req, res) => {
  try {
    const body = req.body;

    if (!body.company) {
      return res.status(400).json({ error: 'Company is required' });
    }

    // Check for duplicate
    const existingResult = await pool.query(
      `SELECT id FROM pipeline WHERE LOWER(company) = LOWER($1) AND LOWER(COALESCE(partner, '')) = LOWER($2)`,
      [body.company, body.partner || '']
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Deal already exists in pipeline' });
    }

    const result = await pool.query(
      `INSERT INTO pipeline (company, deal_type, stage, price, volume, valuation, structure, share_class, partner, partner_email, probability, notes, source, source_id, email_threads)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        body.company,
        body.dealType || 'buy',
        body.stage || 'new_lead',
        body.price || null,
        body.volume || null,
        body.valuation || null,
        body.structure || 'Direct Trade',
        body.shareClass || 'Common',
        body.partner || '',
        body.partnerEmail || '',
        body.probability || 20,
        body.notes || '',
        body.source || 'manual',
        body.sourceId || null,
        JSON.stringify(body.emailThreads || [])
      ]
    );

    const newDeal = result.rows[0];

    // Log creation
    await pool.query(
      'INSERT INTO pipeline_history (deal_id, action, to_stage, trigger) VALUES ($1, $2, $3, $4)',
      [newDeal.id, 'created', newDeal.stage, 'manual']
    );

    res.json({
      success: true,
      deal: {
        id: newDeal.id.toString(),
        company: newDeal.company,
        dealType: newDeal.deal_type,
        stage: newDeal.stage,
        price: newDeal.price,
        volume: newDeal.volume,
        valuation: newDeal.valuation,
        structure: newDeal.structure,
        shareClass: newDeal.share_class,
        partner: newDeal.partner,
        partnerEmail: newDeal.partner_email,
        probability: newDeal.probability,
        notes: newDeal.notes,
        source: newDeal.source,
        sourceId: newDeal.source_id?.toString(),
        emailThreads: newDeal.email_threads || [],
        createdAt: newDeal.created_at?.toISOString(),
        updatedAt: newDeal.updated_at?.toISOString()
      }
    });
  } catch (error) {
    console.error('Pipeline POST error:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// PATCH - Update deal
router.patch('/:id', optionalApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Get current deal
    const currentResult = await pool.query('SELECT * FROM pipeline WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const current = currentResult.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fields = ['company', 'deal_type', 'stage', 'price', 'volume', 'valuation', 'structure', 'share_class', 'partner', 'partner_email', 'probability', 'notes'];
    const bodyFieldMap = {
      deal_type: 'dealType',
      share_class: 'shareClass',
      partner_email: 'partnerEmail'
    };

    for (const field of fields) {
      const bodyField = bodyFieldMap[field] || field;
      if (body[bodyField] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[bodyField]);
        paramIndex++;

        // Log field change to history
        if (field === 'stage' && body[bodyField] !== current[field]) {
          await pool.query(
            'INSERT INTO pipeline_history (deal_id, action, from_stage, to_stage, trigger) VALUES ($1, $2, $3, $4, $5)',
            [id, 'stage_change', current.stage, body[bodyField], 'manual']
          );
        } else if (body[bodyField] !== current[field]) {
          await pool.query(
            'INSERT INTO pipeline_history (deal_id, action, field, old_value, new_value, trigger) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, 'updated', field, String(current[field] || ''), String(body[bodyField]), 'manual']
          );
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `UPDATE pipeline SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);

    const updated = result.rows[0];

    res.json({
      success: true,
      deal: {
        id: updated.id.toString(),
        company: updated.company,
        stage: updated.stage
      }
    });
  } catch (error) {
    console.error('Pipeline PATCH error:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// DELETE - Remove deal
router.delete('/:id', optionalApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM pipeline WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Pipeline DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;

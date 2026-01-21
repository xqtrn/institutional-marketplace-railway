const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');

// GET/POST config
router.get('/config', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'auto_update_config'");

    if (result.rows.length === 0) {
      return res.json({
        criteria: {
          logo: { weight: 10, required: true },
          tagline: { weight: 5, required: false },
          overview: { weight: 15, required: true },
          products: { weight: 10, required: false },
          highlights: { weight: 10, required: false },
          leadership: { weight: 15, required: false },
          investors: { weight: 15, required: false },
          funding: { weight: 10, required: false },
          charts: { weight: 10, required: false }
        }
      });
    }

    res.json(result.rows[0].value);
  } catch (error) {
    console.error('Auto-update config GET error:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.post('/config', validateApiKey, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('auto_update_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(req.body)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Auto-update config POST error:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// POST process - AI research
router.post('/process', validateApiKey, async (req, res) => {
  try {
    const { ticker, mode, existingProfile } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const systemPrompt = mode === 'update'
      ? `You are a financial research assistant. Update the company profile with any new information found. Return valid JSON only.`
      : `You are a financial research assistant. Research the company and return a comprehensive profile in JSON format.`;

    const userPrompt = mode === 'update'
      ? `Update the profile for ${ticker}. Existing profile: ${JSON.stringify(existingProfile)}. Find any new information and return the updated profile.`
      : `Research ${ticker} and create a comprehensive company profile including: overview, products, highlights, leadership, investors, funding history. Return as JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        system: systemPrompt
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(500).json({ error: 'AI processing failed' });
    }

    const aiResponse = await response.json();
    const content = aiResponse.content[0]?.text || '';

    // Try to parse JSON from response
    let profile;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        profile = JSON.parse(jsonMatch[0]);
      } else {
        profile = { raw: content };
      }
    } catch {
      profile = { raw: content };
    }

    // Log result
    await pool.query(
      'INSERT INTO auto_update_results (data) VALUES ($1)',
      [JSON.stringify({ ticker, mode, profile, timestamp: new Date().toISOString() })]
    );

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Auto-update process error:', error);
    res.status(500).json({ error: 'Processing failed', details: error.message });
  }
});

// GET status
router.get('/status', async (req, res) => {
  try {
    const logsResult = await pool.query(
      'SELECT data FROM auto_update_logs ORDER BY created_at DESC LIMIT 50'
    );
    const resultsResult = await pool.query(
      'SELECT data FROM auto_update_results ORDER BY created_at DESC LIMIT 50'
    );
    const queueResult = await pool.query(
      'SELECT data FROM auto_update_queue ORDER BY created_at'
    );

    res.json({
      logs: logsResult.rows.map(r => r.data),
      results: resultsResult.rows.map(r => r.data),
      queue: queueResult.rows.map(r => r.data)
    });
  } catch (error) {
    console.error('Auto-update status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Debug endpoint
router.get('/debug', async (req, res) => {
  res.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasApiSecret: !!process.env.API_SECRET,
    nodeEnv: process.env.NODE_ENV
  });
});

module.exports = router;

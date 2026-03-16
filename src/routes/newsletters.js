const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateBearerToken } = require('../middleware/auth');

// ============================================
// SES EMAIL SENDING
// ============================================
let sesClient = null;

function getSESClient() {
  if (!sesClient) {
    const { SESClient } = require('@aws-sdk/client-ses');
    sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return sesClient;
}

async function sendSESEmail(to, subject, htmlBody, fromEmail, fromName) {
  const { SendEmailCommand } = require('@aws-sdk/client-ses');
  const ses = getSESClient();
  const source = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const cmd = new SendEmailCommand({
    Source: source,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } }
    }
  });

  return ses.send(cmd);
}

// Inject tracking pixel and wrap links
function injectTracking(html, sendId, baseUrl) {
  // Add open tracking pixel before </body> or at end
  const pixel = `<img src="${baseUrl}/api/newsletters/track/open/${sendId}" width="1" height="1" style="display:none;" alt="" />`;

  if (html.includes('</body>')) {
    html = html.replace('</body>', pixel + '</body>');
  } else {
    html += pixel;
  }

  // Wrap links for click tracking
  html = html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    const trackUrl = `${baseUrl}/api/newsletters/track/click/${sendId}?url=${encodeURIComponent(url)}`;
    return `href="${trackUrl}"`;
  });

  // Add unsubscribe link
  const unsubBlock = `<div style="text-align:center;padding:20px;font-size:12px;color:#999;"><a href="${baseUrl}/api/newsletters/unsubscribe/__SUB_ID__" style="color:#999;">Unsubscribe</a></div>`;
  if (html.includes('</body>')) {
    html = html.replace('</body>', unsubBlock + '</body>');
  } else {
    html += unsubBlock;
  }

  return html;
}

// ============================================
// CAMPAIGNS
// ============================================

// GET /campaigns - list all campaigns
router.get('/campaigns', validateBearerToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM newsletter_campaigns';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ campaigns: result.rows });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /campaigns/:id - get single campaign with stats
router.get('/campaigns/:id', validateBearerToken, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await pool.query('SELECT * FROM newsletter_campaigns WHERE id = $1', [id]);

    if (campaign.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get send stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked
      FROM newsletter_sends WHERE campaign_id = $1
    `, [id]);

    res.json({
      campaign: campaign.rows[0],
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /campaigns - create campaign
router.post('/campaigns', validateBearerToken, async (req, res) => {
  try {
    const { subject, preview_text, html_content, from_name, from_email } = req.body;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const result = await pool.query(
      `INSERT INTO newsletter_campaigns (subject, preview_text, html_content, from_name, from_email)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [subject, preview_text || '', html_content || '', from_name || 'Silicon Valley Investclub', from_email || 'siliconvalleyinvestclub@mail.siliconvalleyinvestclub.com']
    );

    res.json({ success: true, campaign: result.rows[0] });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /campaigns/:id - update campaign
router.patch('/campaigns/:id', validateBearerToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, preview_text, html_content, from_name, from_email } = req.body;

    // Only allow editing drafts
    const existing = await pool.query('SELECT status FROM newsletter_campaigns WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (existing.rows[0].status !== 'draft') return res.status(400).json({ error: 'Can only edit draft campaigns' });

    const fields = [];
    const values = [];
    let idx = 1;

    if (subject !== undefined) { fields.push(`subject = $${idx++}`); values.push(subject); }
    if (preview_text !== undefined) { fields.push(`preview_text = $${idx++}`); values.push(preview_text); }
    if (html_content !== undefined) { fields.push(`html_content = $${idx++}`); values.push(html_content); }
    if (from_name !== undefined) { fields.push(`from_name = $${idx++}`); values.push(from_name); }
    if (from_email !== undefined) { fields.push(`from_email = $${idx++}`); values.push(from_email); }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE newsletter_campaigns SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ success: true, campaign: result.rows[0] });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /campaigns/:id
router.delete('/campaigns/:id', validateBearerToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT status FROM newsletter_campaigns WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (existing.rows[0].status === 'sending') return res.status(400).json({ error: 'Cannot delete while sending' });

    await pool.query('DELETE FROM newsletter_campaigns WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /campaigns/:id/send - send campaign
router.post('/campaigns/:id/send', validateBearerToken, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await pool.query('SELECT * FROM newsletter_campaigns WHERE id = $1', [id]);

    if (campaign.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (campaign.rows[0].status !== 'draft') return res.status(400).json({ error: 'Campaign already sent or sending' });
    if (!campaign.rows[0].html_content) return res.status(400).json({ error: 'Campaign has no content' });

    // Check SES credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(500).json({ error: 'AWS SES credentials not configured' });
    }

    // Get active subscribers
    const subscribers = await pool.query(
      'SELECT * FROM newsletter_subscribers WHERE status = $1',
      ['active']
    );

    if (subscribers.rows.length === 0) {
      return res.status(400).json({ error: 'No active subscribers' });
    }

    const camp = campaign.rows[0];
    const subs = subscribers.rows;

    // Update campaign status
    await pool.query(
      'UPDATE newsletter_campaigns SET status = $1, total_recipients = $2, updated_at = NOW() WHERE id = $3',
      ['sending', subs.length, id]
    );

    // Create send records
    for (const sub of subs) {
      await pool.query(
        `INSERT INTO newsletter_sends (campaign_id, subscriber_id, status)
         VALUES ($1, $2, 'queued') ON CONFLICT (campaign_id, subscriber_id) DO NOTHING`,
        [id, sub.id]
      );
    }

    // Respond immediately, send in background
    res.json({ success: true, message: 'Sending started', total: subs.length });

    // Determine base URL
    const baseUrl = process.env.BASE_URL || 'https://platform.siliconvalleyinvestclub.com';

    // Background sending with throttling
    let sentCount = 0;
    let failedCount = 0;
    const BATCH_SIZE = 14;
    const BATCH_DELAY = 1100; // ms between batches

    for (let i = 0; i < subs.length; i += BATCH_SIZE) {
      const batch = subs.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (sub) => {
        try {
          // Get send record ID
          const sendRecord = await pool.query(
            'SELECT id FROM newsletter_sends WHERE campaign_id = $1 AND subscriber_id = $2',
            [id, sub.id]
          );
          const sendId = sendRecord.rows[0].id;

          // Prepare HTML with tracking
          let html = injectTracking(camp.html_content, sendId, baseUrl);
          html = html.replace('__SUB_ID__', sub.id);

          // Send via SES
          const result = await sendSESEmail(
            sub.email,
            camp.subject,
            html,
            camp.from_email,
            camp.from_name
          );

          // Update send record
          await pool.query(
            `UPDATE newsletter_sends SET status = 'sent', ses_message_id = $1, sent_at = NOW() WHERE id = $2`,
            [result.MessageId, sendId]
          );

          sentCount++;
        } catch (err) {
          console.error(`Failed to send to ${sub.email}:`, err.message);

          const sendRecord = await pool.query(
            'SELECT id FROM newsletter_sends WHERE campaign_id = $1 AND subscriber_id = $2',
            [id, sub.id]
          );
          if (sendRecord.rows.length > 0) {
            await pool.query(
              `UPDATE newsletter_sends SET status = 'failed', error_message = $1 WHERE id = $2`,
              [err.message, sendRecord.rows[0].id]
            );
          }

          failedCount++;
        }
      });

      await Promise.all(promises);

      // Update progress
      await pool.query(
        'UPDATE newsletter_campaigns SET total_sent = $1, total_failed = $2, updated_at = NOW() WHERE id = $3',
        [sentCount, failedCount, id]
      );

      // Throttle
      if (i + BATCH_SIZE < subs.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    // Finalize
    await pool.query(
      `UPDATE newsletter_campaigns SET status = 'sent', sent_at = NOW(), total_sent = $1, total_failed = $2, updated_at = NOW() WHERE id = $3`,
      [sentCount, failedCount, id]
    );

    console.log(`Campaign ${id} sent: ${sentCount} sent, ${failedCount} failed`);

  } catch (error) {
    console.error('Send campaign error:', error);
    // Try to update campaign status to failed
    try {
      await pool.query('UPDATE newsletter_campaigns SET status = $1 WHERE id = $2', ['failed', req.params.id]);
    } catch (e) {}
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// POST /campaigns/:id/test - send test email
router.post('/campaigns/:id/test', validateBearerToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Test email address required' });

    const campaign = await pool.query('SELECT * FROM newsletter_campaigns WHERE id = $1', [id]);
    if (campaign.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (!process.env.AWS_ACCESS_KEY_ID) {
      return res.status(500).json({ error: 'AWS SES credentials not configured' });
    }

    const camp = campaign.rows[0];
    const subject = `[TEST] ${camp.subject}`;

    await sendSESEmail(email, subject, camp.html_content, camp.from_email, camp.from_name);

    res.json({ success: true, message: `Test email sent to ${email}` });
  } catch (error) {
    console.error('Test send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUBSCRIBERS
// ============================================

// GET /subscribers - list subscribers
router.get('/subscribers', validateBearerToken, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM newsletter_subscribers';
    let countQuery = 'SELECT COUNT(*) FROM newsletter_subscribers';
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(email ILIKE $${idx} OR name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      query += where;
      countQuery += where;
    }

    // Count
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Data
    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      subscribers: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('List subscribers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /subscribers - add single subscriber
router.post('/subscribers', validateBearerToken, async (req, res) => {
  try {
    const { email, name, tags } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (email, name, tags, source)
       VALUES ($1, $2, $3, 'manual')
       ON CONFLICT (email) DO UPDATE SET name = COALESCE($2, newsletter_subscribers.name)
       RETURNING *`,
      [email.toLowerCase().trim(), name || null, JSON.stringify(tags || [])]
    );

    res.json({ success: true, subscriber: result.rows[0] });
  } catch (error) {
    console.error('Add subscriber error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /subscribers/import-csv - import from CSV text
router.post('/subscribers/import-csv', validateBearerToken, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'CSV data required' });

    const lines = csv.trim().split('\n');
    let imported = 0;
    let skipped = 0;

    for (const line of lines) {
      const parts = line.trim().split(',');
      const email = parts[0]?.trim().toLowerCase();
      const name = parts[1]?.trim() || null;

      if (!email || !email.includes('@')) {
        skipped++;
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO newsletter_subscribers (email, name, source)
           VALUES ($1, $2, 'csv')
           ON CONFLICT (email) DO NOTHING`,
          [email, name]
        );
        imported++;
      } catch (e) {
        skipped++;
      }
    }

    res.json({ success: true, imported, skipped, total: lines.length });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /subscribers/import-beehiiv - import from Beehiiv API
router.post('/subscribers/import-beehiiv', validateBearerToken, async (req, res) => {
  try {
    const apiKey = process.env.BEEHIIV_API_KEY;
    const pubId = process.env.BEEHIIV_PUBLICATION_ID || 'pub_421735a3-9bb8-4cac-a892-321780126aa8';

    if (!apiKey) return res.status(500).json({ error: 'Beehiiv API key not configured' });

    let imported = 0;
    let skipped = 0;
    let page = 1;
    let hasMore = true;

    // Respond with progress endpoint
    res.json({ success: true, message: 'Import started in background. Check /subscribers for progress.' });

    // Background import with pagination
    while (hasMore) {
      try {
        const url = `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions?status=active&limit=100&page=${page}&expand=stats`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
          console.error('Beehiiv API error:', response.status);
          break;
        }

        const data = await response.json();
        const subs = data.data || [];

        if (subs.length === 0) {
          hasMore = false;
          break;
        }

        for (const sub of subs) {
          try {
            // Only import subscribers who received emails (delivered)
            const totalReceived = sub.stats?.total_received || 0;

            await pool.query(
              `INSERT INTO newsletter_subscribers (email, source, beehiiv_id, tags)
               VALUES ($1, 'beehiiv', $2, $3)
               ON CONFLICT (email) DO UPDATE SET beehiiv_id = $2`,
              [sub.email.toLowerCase(), sub.id, JSON.stringify([totalReceived > 0 ? 'delivered' : 'not_delivered'])]
            );
            imported++;
          } catch (e) {
            skipped++;
          }
        }

        // Check for next page
        hasMore = data.total_results > page * 100;
        page++;

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error('Beehiiv import page error:', err.message);
        hasMore = false;
      }
    }

    console.log(`Beehiiv import complete: ${imported} imported, ${skipped} skipped`);

  } catch (error) {
    console.error('Beehiiv import error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// DELETE /subscribers/:id
router.delete('/subscribers/:id', validateBearerToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM newsletter_subscribers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /subscribers - bulk delete
router.delete('/subscribers', validateBearerToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'No IDs provided' });

    await pool.query('DELETE FROM newsletter_subscribers WHERE id = ANY($1)', [ids]);
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRACKING (public endpoints, no auth)
// ============================================

// GET /track/open/:sendId - tracking pixel
router.get('/track/open/:sendId', async (req, res) => {
  try {
    const { sendId } = req.params;

    // Update opened_at (only first open)
    await pool.query(
      `UPDATE newsletter_sends SET opened_at = NOW() WHERE id = $1 AND opened_at IS NULL`,
      [sendId]
    );

    // Update campaign counter
    await pool.query(`
      UPDATE newsletter_campaigns SET total_opened = (
        SELECT COUNT(*) FROM newsletter_sends WHERE campaign_id = (
          SELECT campaign_id FROM newsletter_sends WHERE id = $1
        ) AND opened_at IS NOT NULL
      ) WHERE id = (SELECT campaign_id FROM newsletter_sends WHERE id = $1)
    `, [sendId]);

  } catch (e) {
    // Silent fail for tracking
  }

  // Return 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  });
  res.end(pixel);
});

// GET /track/click/:sendId - click tracking redirect
router.get('/track/click/:sendId', async (req, res) => {
  const { sendId } = req.params;
  const { url } = req.query;

  try {
    // Update clicked_at (only first click)
    await pool.query(
      `UPDATE newsletter_sends SET clicked_at = NOW() WHERE id = $1 AND clicked_at IS NULL`,
      [sendId]
    );

    // Update campaign counter
    await pool.query(`
      UPDATE newsletter_campaigns SET total_clicked = (
        SELECT COUNT(*) FROM newsletter_sends WHERE campaign_id = (
          SELECT campaign_id FROM newsletter_sends WHERE id = $1
        ) AND clicked_at IS NOT NULL
      ) WHERE id = (SELECT campaign_id FROM newsletter_sends WHERE id = $1)
    `, [sendId]);

  } catch (e) {
    // Silent fail
  }

  // Redirect to actual URL
  if (url) {
    res.redirect(302, decodeURIComponent(url));
  } else {
    res.redirect(302, 'https://siliconvalleyinvestclub.com');
  }
});

// GET /unsubscribe/:subscriberId - unsubscribe
router.get('/unsubscribe/:subscriberId', async (req, res) => {
  try {
    await pool.query(
      `UPDATE newsletter_subscribers SET status = 'unsubscribed' WHERE id = $1`,
      [req.params.subscriberId]
    );
  } catch (e) {}

  res.send(`
    <html>
    <head><title>Unsubscribed</title></head>
    <body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
      <div style="text-align: center;">
        <h2>You have been unsubscribed</h2>
        <p style="color: #666;">You will no longer receive newsletters from Silicon Valley Investclub.</p>
      </div>
    </body>
    </html>
  `);
});

// GET /subscribers/count - quick count
router.get('/subscribers/count', validateBearerToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced
      FROM newsletter_subscribers
    `);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

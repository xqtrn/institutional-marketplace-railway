const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db');

const SUPER_ADMIN_USERNAME = 'arthurium';

// Validate Telegram Login Widget data
function validateTelegramAuth(data) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const { hash, ...rest } = data;
  if (!hash) return false;

  // Build check string: sorted key=value pairs
  const checkString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (hmac !== hash) return false;

  // Check auth_date is not too old (allow 1 day)
  const authDate = parseInt(data.auth_date);
  if (Math.abs(Date.now() / 1000 - authDate) > 86400) return false;

  return true;
}

// Telegram auth endpoint
router.post('/telegram', async (req, res) => {
  try {
    const telegramData = req.body;

    if (!validateTelegramAuth(telegramData)) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    const telegramId = parseInt(telegramData.id);
    const username = (telegramData.username || '').toLowerCase();
    const firstName = telegramData.first_name || '';
    const photoUrl = telegramData.photo_url || null;

    // Determine role
    const role = username === SUPER_ADMIN_USERNAME ? 'super_admin' : 'user';
    const permissions = role === 'super_admin' ? ['all'] : [];

    // Find or create user by telegram_id
    const existing = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );

    let user;
    if (existing.rows.length > 0) {
      // Update existing user info
      await pool.query(
        `UPDATE users SET telegram_username = $1, telegram_first_name = $2, telegram_photo_url = $3, role = $4, permissions = $5 WHERE telegram_id = $6`,
        [username, firstName, photoUrl, role, JSON.stringify(permissions), telegramId]
      );
      user = existing.rows[0];
      user.role = role;
      user.permissions = permissions;
      user.telegram_username = username;
      user.telegram_first_name = firstName;
    } else {
      // Create new user
      const result = await pool.query(
        `INSERT INTO users (telegram_id, telegram_username, telegram_first_name, telegram_photo_url, role, permissions)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [telegramId, username, firstName, photoUrl, role, JSON.stringify(permissions)]
      );
      user = result.rows[0];
    }

    res.json({
      success: true,
      user: {
        telegram_id: telegramId,
        username: username,
        first_name: firstName,
        photo_url: photoUrl,
        role: user.role,
        permissions: user.permissions || permissions
      }
    });
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Config endpoint - returns bot username for the widget
router.get('/config', (req, res) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return res.status(500).json({ error: 'Bot not configured' });
  }
  res.json({ botUsername });
});

module.exports = router;

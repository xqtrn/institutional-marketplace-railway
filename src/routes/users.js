const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateBearerToken } = require('../middleware/auth');

// Get all users (requires super_admin)
router.get('/', validateBearerToken, async (req, res) => {
  try {
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE telegram_id = $1',
      [req.telegramId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      'SELECT id, telegram_id, telegram_username, telegram_first_name, telegram_photo_url, email, role, permissions, created_at FROM users ORDER BY created_at ASC'
    );

    const users = result.rows.map(row => ({
      id: row.id,
      telegram_id: row.telegram_id,
      username: row.telegram_username,
      first_name: row.telegram_first_name,
      photo_url: row.telegram_photo_url,
      email: row.email,
      role: row.role,
      permissions: row.permissions || [],
      createdAt: row.created_at?.toISOString()
    }));

    res.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role/permissions
router.post('/save', validateBearerToken, async (req, res) => {
  try {
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE telegram_id = $1',
      [req.telegramId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id, role, permissions } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await pool.query(
      'UPDATE users SET role = $1, permissions = $2 WHERE id = $3',
      [role || 'user', JSON.stringify(permissions || []), id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Users save error:', error);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

// Delete user
router.post('/delete', validateBearerToken, async (req, res) => {
  try {
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE telegram_id = $1',
      [req.telegramId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Users delete error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;

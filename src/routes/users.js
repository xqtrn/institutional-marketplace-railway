const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { pool } = require('../db');
const { validateBearerToken } = require('../middleware/auth');

const SALT = 'im_salt_2024';

function hashPassword(password) {
  return CryptoJS.SHA256(password + SALT).toString();
}

// Get all users (requires super_admin)
router.get('/', validateBearerToken, async (req, res) => {
  try {
    // Check if requester is super_admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE email = $1',
      [req.userEmail]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query('SELECT id, email, role, permissions, created_at FROM users ORDER BY created_at ASC');

    const users = result.rows.map(row => ({
      email: row.email,
      role: row.role,
      permissions: row.permissions || [],
      createdAt: row.created_at?.toISOString()
    }));

    // Match Cloudflare format
    res.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create/Update user
router.post('/save', validateBearerToken, async (req, res) => {
  try {
    // Check if requester is super_admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE email = $1',
      [req.userEmail]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id, email, password, role, permissions } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (id) {
      // Update existing user
      if (password) {
        await pool.query(
          'UPDATE users SET email = $1, password_hash = $2, role = $3, permissions = $4 WHERE id = $5',
          [email.toLowerCase(), hashPassword(password), role || 'user', JSON.stringify(permissions || []), id]
        );
      } else {
        await pool.query(
          'UPDATE users SET email = $1, role = $2, permissions = $3 WHERE id = $4',
          [email.toLowerCase(), role || 'user', JSON.stringify(permissions || []), id]
        );
      }
    } else {
      // Create new user
      if (!password) {
        return res.status(400).json({ error: 'Password is required for new users' });
      }

      await pool.query(
        'INSERT INTO users (email, password_hash, role, permissions) VALUES ($1, $2, $3, $4)',
        [email.toLowerCase(), hashPassword(password), role || 'user', JSON.stringify(permissions || [])]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Users save error:', error);
    res.status(500).json({ error: 'Failed to save user' });
  }
});

// Delete user
router.post('/delete', validateBearerToken, async (req, res) => {
  try {
    // Check if requester is super_admin
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE email = $1',
      [req.userEmail]
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

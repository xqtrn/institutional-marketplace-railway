const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { validateApiKey } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT company, url FROM logos');

    if (result.rows.length > 0) {
      const logos = {};
      for (const row of result.rows) {
        logos[row.company] = row.url;
      }
      return res.json(logos);
    }

    // Fallback to static file
    const staticPath = path.join(__dirname, '../../public/api/logos.json');
    if (fs.existsSync(staticPath)) {
      const data = fs.readFileSync(staticPath, 'utf8');
      return res.json(JSON.parse(data));
    }

    res.json({});
  } catch (error) {
    console.error('Logos GET error:', error);
    res.status(500).json({ error: 'Failed to fetch logos' });
  }
});

router.post('/', validateApiKey, async (req, res) => {
  try {
    const logos = req.body;

    if (typeof logos !== 'object') {
      return res.status(400).json({ error: 'Data must be an object' });
    }

    await pool.query('DELETE FROM logos');

    for (const [company, url] of Object.entries(logos)) {
      await pool.query(
        'INSERT INTO logos (company, url) VALUES ($1, $2)',
        [company, url]
      );
    }

    res.json({ success: true, count: Object.keys(logos).length });
  } catch (error) {
    console.error('Logos POST error:', error);
    res.status(500).json({ error: 'Failed to update logos' });
  }
});

// Upload a single logo file and register it in DB
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

router.post('/upload', validateApiKey, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const company = req.body.company;
    const filename = req.body.filename; // e.g. "assets/logos/SpaceX.png"
    if (!company || !filename) return res.status(400).json({ error: 'company and filename required' });

    // Save file to public directory
    const filePath = path.join(__dirname, '../../public', filename);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, req.file.buffer);

    // Upsert in DB
    await pool.query(
      'INSERT INTO logos (company, url) VALUES ($1, $2) ON CONFLICT (company) DO UPDATE SET url = $2',
      [company, filename]
    );

    res.json({ success: true, company, filename });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

module.exports = router;

require('dotenv').config();
const { pool } = require('./index');

// This script migrates data from Cloudflare KV export files to PostgreSQL

async function migrate() {
  const fs = require('fs');
  const path = require('path');

  console.log('Starting data migration...');

  try {
    // Run schema first
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Schema created');

    // Load static data files
    const publicPath = path.join(__dirname, '../../public/api');

    // Migrate buy deals
    const buyPath = path.join(publicPath, 'buy.json');
    if (fs.existsSync(buyPath)) {
      const buyData = JSON.parse(fs.readFileSync(buyPath, 'utf8'));
      for (const deal of buyData) {
        await pool.query(
          `INSERT INTO deals (deal_type, company, price, volume, valuation, structure, share_class, series, management_fee, carry, partner, partner_id, source, status, last_update)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT DO NOTHING`,
          ['buy', deal.company, deal.price, deal.volume, deal.valuation, deal.structure, deal.shareClass, deal.series, deal.managementFee || 0, deal.carry || 0, deal.partner, deal.partnerId, deal.source || 'manual', deal.status || 'active', deal.lastUpdate || new Date().toISOString()]
        );
      }
      console.log(`Migrated ${buyData.length} buy deals`);
    }

    // Migrate sell deals
    const sellPath = path.join(publicPath, 'sell.json');
    if (fs.existsSync(sellPath)) {
      const sellData = JSON.parse(fs.readFileSync(sellPath, 'utf8'));
      for (const deal of sellData) {
        await pool.query(
          `INSERT INTO deals (deal_type, company, price, volume, valuation, structure, share_class, series, management_fee, carry, partner, partner_id, source, status, last_update)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT DO NOTHING`,
          ['sell', deal.company, deal.price, deal.volume, deal.valuation, deal.structure, deal.shareClass, deal.series, deal.managementFee || 0, deal.carry || 0, deal.partner, deal.partnerId, deal.source || 'manual', deal.status || 'active', deal.lastUpdate || new Date().toISOString()]
        );
      }
      console.log(`Migrated ${sellData.length} sell deals`);
    }

    // Migrate logos
    const logosPath = path.join(publicPath, 'logos.json');
    if (fs.existsSync(logosPath)) {
      const logosData = JSON.parse(fs.readFileSync(logosPath, 'utf8'));
      for (const [company, url] of Object.entries(logosData)) {
        await pool.query(
          'INSERT INTO logos (company, url) VALUES ($1, $2) ON CONFLICT (company) DO UPDATE SET url = $2',
          [company, url]
        );
      }
      console.log(`Migrated ${Object.keys(logosData).length} logos`);
    }

    // Create default admin user
    const CryptoJS = require('crypto-js');
    const SALT = 'im_salt_2024';
    const adminPassword = CryptoJS.SHA256('Сс227081!' + SALT).toString();

    await pool.query(
      `INSERT INTO users (email, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['arthur@investclub.sv', adminPassword, 'super_admin', JSON.stringify(['all'])]
    );
    console.log('Created admin user');

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

migrate();

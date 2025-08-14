// db.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'cves.sqlite');

async function init() {
  // ensure dir exists
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir) && dir !== '.') fs.mkdirSync(dir, { recursive: true });

  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // Create table for CVEs (id primary key)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cves (
      id TEXT PRIMARY KEY,
      publishedDate TEXT,
      lastModifiedDate TEXT,
      description TEXT,
      baseScoreV2 REAL,
      baseScoreV3 REAL,
      raw JSON
    );
  `);

  // index to speed filters by date
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_cves_lastModified ON cves(lastModifiedDate);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(publishedDate);`);

  return db;
}

module.exports = { init };
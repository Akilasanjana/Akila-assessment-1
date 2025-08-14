// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodeCron = require('node-cron');
const path = require('path');
const { init } = require('./db');
const { fullSync } = require('./syncService');

const PORT = process.env.PORT || 3000;
const SYNC_CRON = process.env.SYNC_CRON || '0 */6 * * *'; // every 6 hours by default

async function main() {
  const db = await init();

  const app = express();
  app.use(bodyParser.json());
  app.use(cors());

  // Serve frontend public folder
  app.use(express.static(path.join(__dirname, 'public')));

  // API routes
  const cvesRouter = require('./routes/cves')(db);
  app.use('/api/cves', cvesRouter);

  // Frontend routes for requested paths
  app.get('/cves/list', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  app.get('/cves/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cve.html'));
  });

  // Manual sync trigger (protected? currently open — in production add auth)
  app.post('/admin/sync', async (req, res) => {
    try {
      await fullSync(db, (progress) => {
        // optional: log
        console.log('sync progress', progress);
      });
      res.json({ status: 'ok' });
    } catch (err) {
      console.error('sync error', err);
      res.status(500).json({ error: 'sync failed' });
    }
  });

  // Periodic job
  nodeCron.schedule(SYNC_CRON, async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting scheduled CVE sync...`);
      await fullSync(db, (p) => console.log('sync', p));
      console.log('Scheduled sync complete');
    } catch (err) {
      console.error('Scheduled sync error', err);
    }
  });

  // start server
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log('Open /cves/list in the browser');
  });
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});

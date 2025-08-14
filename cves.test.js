// tests/cves.test.js
const request = require('supertest');
const express = require('express');
const { init } = require('../db');
const cvesRoutesFactory = require('../routes/cves');

let app, db;

beforeAll(async () => {
  db = await init();

  // insert a sample record for testing
  await db.run(`
    INSERT OR REPLACE INTO cves (id, publishedDate, lastModifiedDate, description, baseScoreV2, baseScoreV3, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    'CVE-TEST-0001',
    '2025-01-01T00:00:00Z',
    '2025-01-02T00:00:00Z',
    'Test description',
    5.0,
    6.1,
    JSON.stringify({ cve: { id: 'CVE-TEST-0001' } })
  ]);

  app = express();
  app.use('/api/cves', cvesRoutesFactory(db));
});

afterAll(async () => {
  if (db) await db.close();
});

test('GET /api/cves returns paginated results', async () => {
  const res = await request(app).get('/api/cves').query({ limit: 10, page:1 });
  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveProperty('total');
  expect(res.body).toHaveProperty('results');
  const found = res.body.results.find(r => r.id === 'CVE-TEST-0001');
  expect(found).toBeTruthy();
});

test('GET /api/cves/:id returns raw JSON', async () => {
  const res = await request(app).get('/api/cves/CVE-TEST-0001');
  expect(res.statusCode).toBe(200);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  const body = res.body;
  expect(body).toHaveProperty('cve');
  expect(body.cve.id).toBe('CVE-TEST-0001');
});

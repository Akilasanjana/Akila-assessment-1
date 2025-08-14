// syncService.js
const fetch = require('node-fetch');
const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const RESULTS_PER_PAGE = 2000; // NVD allows large pages; tune as needed
const API_KEY = process.env.NVD_API_KEY || null;

function getHeaders() {
  const headers = { 'User-Agent': 'cve-sync-ui/1.0' };
  if (API_KEY) headers['apiKey'] = API_KEY;
  return headers;
}

/**
 * Fetch chunk starting at startIndex
 * returns parsed JSON, or null on error
 */
async function fetchChunk(startIndex = 0, resultsPerPage = RESULTS_PER_PAGE) {
  const url = new URL(NVD_BASE);
  url.searchParams.set('startIndex', String(startIndex));
  url.searchParams.set('resultsPerPage', String(resultsPerPage));
  const resp = await fetch(url.toString(), { headers: getHeaders(), timeout: 120000 });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`NVD fetch failed: ${resp.status} ${resp.statusText} ${txt}`);
  }
  return resp.json();
}

/**
 * Upsert CVE items into DB.
 * Accepts db (opened sqlite connection via `db.run` / prepare) - we assume it's the 'sqlite' package DB.
 */
async function upsertBatch(db, items) {
  const insertSql = `
    INSERT INTO cves (id, publishedDate, lastModifiedDate, description, baseScoreV2, baseScoreV3, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      publishedDate=excluded.publishedDate,
      lastModifiedDate=excluded.lastModifiedDate,
      description=excluded.description,
      baseScoreV2=excluded.baseScoreV2,
      baseScoreV3=excluded.baseScoreV3,
      raw=excluded.raw;
  `;

  const stmt = await db.prepare(insertSql);
  try {
    await db.run("BEGIN TRANSACTION");
    for (const item of items) {
      const id = item.cve.id;
      const publishedDate = item.cve?.published || null;
      const lastModifiedDate = item.cve?.lastModified || null;
      const description = (item.cve?.descriptions && item.cve.descriptions.length > 0)
        ? item.cve.descriptions.map(d => d.value).join('\n')
        : null;

      // Extract CVSS base scores if present
      let baseScoreV2 = null;
      let baseScoreV3 = null;
      try {
        const metrics = item.metrics;
        if (metrics) {
          // try v3 first
          if (metrics.cvssMetricV31 && Array.isArray(metrics.cvssMetricV31) && metrics.cvssMetricV31[0]?.cvssData?.baseScore) {
            baseScoreV3 = metrics.cvssMetricV31[0].cvssData.baseScore;
          } else if (metrics.cvssMetricV3 && Array.isArray(metrics.cvssMetricV3) && metrics.cvssMetricV3[0]?.cvssData?.baseScore) {
            baseScoreV3 = metrics.cvssMetricV3[0].cvssData.baseScore;
          }
          // v2
          if (metrics.cvssMetricV2 && Array.isArray(metrics.cvssMetricV2) && metrics.cvssMetricV2[0]?.cvssData?.baseScore) {
            baseScoreV2 = metrics.cvssMetricV2[0].cvssData.baseScore;
          }
        }
      } catch (e) {
        // ignore parsing errors, leave scores null
      }

      const raw = JSON.stringify(item);

      await stmt.run([id, publishedDate, lastModifiedDate, description, baseScoreV2, baseScoreV3, raw]);
    }
    await db.run("COMMIT");
  } catch (err) {
    await db.run("ROLLBACK");
    throw err;
  } finally {
    await stmt.finalize();
  }
}

/**
 * Full synchronization - pages through all CVEs and upserts.
 * If `since` is provided, it adds lastModifiedStartDate param (incremental). NVD supports a modifiedStartDate param like '?lastModStartDate' — but for v2.0 we'll rely on retrieving all and deduplicating.
 */
async function fullSync(db, onProgress = () => {}) {
  let startIndex = 0;
  let totalResults = null;
  while (true) {
    onProgress({ startIndex });
    const data = await fetchChunk(startIndex);
    if (!data || !data.vulnerabilities) break;

    const items = data.vulnerabilities;
    await upsertBatch(db, items);

    // NVD v2.0 returns totalResults or totalResults? fallback:
    totalResults = data.totalResults ?? null;
    const received = items.length;
    startIndex += received;

    if (totalResults !== null) {
      onProgress({ processed: startIndex, totalResults });
      if (startIndex >= totalResults) break;
    } else {
      // if API doesn't return totalResults, stop when fewer than page size returned
      if (received < RESULTS_PER_PAGE) break;
    }
  }
}

module.exports = { fullSync, fetchChunk, upsertBatch };
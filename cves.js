// routes/cves.js
const express = require('express');
const router = express.Router();

/**
 * Query params:
 *  - id (exact CVE ID)
 *  - year (e.g. 1999)
 *  - minScore / maxScore (applies to either V3 then V2)
 *  - lastModifiedDays (e.g. 30)
 *  - page (1-based)
 *  - limit (10,50,100)
 *  - sortBy (publishedDate | lastModifiedDate)
 *  - order (asc|desc)
 */
module.exports = (db) => {
  router.get('/', async (req, res) => {
    try {
      const {
        id,
        year,
        minScore,
        maxScore,
        lastModifiedDays,
        page = 1,
        limit = 10,
        sortBy = 'publishedDate',
        order = 'desc'
      } = req.query;

      const allowedSort = new Set(['publishedDate', 'lastModifiedDate']);
      const sortCol = allowedSort.has(sortBy) ? sortBy : 'publishedDate';
      const orderSql = order && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
      const offset = (Math.max(1, Number(page) || 1) - 1) * limitNum;

      const whereClauses = [];
      const params = [];

      if (id) {
        whereClauses.push('id = ?');
        params.push(id);
      }

      if (year) {
        whereClauses.push("strftime('%Y', publishedDate) = ?");
        params.push(String(year));
      }

      if (minScore !== undefined) {
        whereClauses.push('(COALESCE(baseScoreV3, baseScoreV2) >= ?)');
        params.push(Number(minScore));
      }
      if (maxScore !== undefined) {
        whereClauses.push('(COALESCE(baseScoreV3, baseScoreV2) <= ?)');
        params.push(Number(maxScore));
      }

      if (lastModifiedDays !== undefined) {
        const days = Number(lastModifiedDays) || 0;
        whereClauses.push("datetime(lastModifiedDate) >= datetime('now', ?)");
        params.push(`-${days} days`);
      }

      const whereSql = whereClauses.length ? ('WHERE ' + whereClauses.join(' AND ')) : '';

      // total count
      const countRow = await db.get(`SELECT COUNT(1) as cnt FROM cves ${whereSql}`, params);
      const total = countRow ? countRow.cnt : 0;

      // fetch page
      const rows = await db.all(
        `SELECT id, publishedDate, lastModifiedDate, description, baseScoreV2, baseScoreV3
         FROM cves ${whereSql}
         ORDER BY ${sortCol} ${orderSql}
         LIMIT ? OFFSET ?`,
        ...params, limitNum, offset
      );

      res.json({
        total,
        page: Number(page),
        limit: limitNum,
        results: rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // single CVE detail
  router.get('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const row = await db.get('SELECT raw FROM cves WHERE id = ?', id);
      if (!row) return res.status(404).json({ error: 'CVE not found' });
      res.type('json').send(row.raw);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};

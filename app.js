// public/js/app.js
(function () {
  const tableBody = document.querySelector('#cveTable tbody');
  const totalRecordsEl = document.getElementById('totalRecords');
  const resultsPerPageEl = document.getElementById('resultsPerPage');
  const filterIdEl = document.getElementById('filterId');
  const applyFiltersBtn = document.getElementById('applyFilters');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const currentPageEl = document.getElementById('currentPage');

  let page = 1;

  function buildApiUrl() {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', resultsPerPageEl.value);
    const filterId = filterIdEl.value.trim();
    if (filterId) params.set('id', filterId);
    // optionally add sorting params here
    return '/api/cves?' + params.toString();
  }

  async function load() {
    const url = buildApiUrl();
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      totalRecordsEl.textContent = data.total ?? '-';
      currentPageEl.textContent = data.page ?? page;

      // fill table
      tableBody.innerHTML = '';
      (data.results || []).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cve-id">${escapeHtml(row.id)}</td>
          <td>${escapeHtml(row.publishedDate || '')}</td>
          <td>${escapeHtml(row.lastModifiedDate || '')}</td>
          <td>${escapeHtml((row.baseScoreV3 ?? '') + (row.baseScoreV3 && row.baseScoreV2 ? ' / ' + row.baseScoreV2 : '') )}</td>
          <td>${escapeHtml((row.description || '').slice(0, 120))}</td>
        `;
        tr.addEventListener('click', () => {
          window.location.href = `/cves/${encodeURIComponent(row.id)}`;
        });
        tableBody.appendChild(tr);
      });

      // enable/disable prev/next
      prevBtn.disabled = (page <= 1);
      nextBtn.disabled = ((page * Number(resultsPerPageEl.value)) >= (data.total || 0));
    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="5">Failed to load data</td></tr>`;
    }
  }

  // small utility to avoid XSS from raw DB values in this simple frontend
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  resultsPerPageEl.addEventListener('change', () => {
    page = 1;
    load();
  });
  applyFiltersBtn.addEventListener('click', () => {
    page = 1;
    load();
  });

  prevBtn.addEventListener('click', () => {
    if (page > 1) {
      page--;
      load();
    }
  });
  nextBtn.addEventListener('click', () => {
    page++;
    load();
  });

  // initial load
  load();
})();

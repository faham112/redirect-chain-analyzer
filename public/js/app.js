let currentResult = null;
let chart = null;

document.getElementById('analyzeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  document.getElementById('loading').classList.remove('d-none');
  document.getElementById('errorAlert').classList.add('d-none');
  document.getElementById('results').classList.add('d-none');
  document.getElementById('analyzeBtn').disabled = true;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');
    currentResult = data;
    renderResults(data);
    loadHistory();
  } catch (err) {
    document.getElementById('errorAlert').textContent = err.message;
    document.getElementById('errorAlert').classList.remove('d-none');
  } finally {
    document.getElementById('loading').classList.add('d-none');
    document.getElementById('analyzeBtn').disabled = false;
  }
});

function renderResults(data) {
  document.getElementById('results').classList.remove('d-none');
  document.getElementById('originalUrl').textContent = data.originalUrl;
  document.getElementById('finalUrl').textContent = data.finalUrl || '— (blocked / error / loop)';

  const container = document.getElementById('chainContainer');
  container.innerHTML = '';
  data.chain.forEach(step => {
    const div = document.createElement('div');
    div.className = `chain-step ${step.error ? 'error' : (step.warning || step.jsIndicators?.length ? 'warning' : '')}`;
    const status = step.status ? `<span class="badge bg-${step.status >= 300 && step.status < 400 ? 'info' : step.status >= 400 ? 'danger' : 'success'} status-badge">${step.status}</span>` : '';
    const badges = [];
    if (step.domainChanged) badges.push('<span class="badge bg-warning text-dark">Domain Change</span>');
    if (step.isShortener) badges.push('<span class="badge bg-secondary">Shortener</span>');
    if (step.isGoogleShare) badges.push('<span class="badge bg-primary">Google Share</span>');
    if (step.type === 'meta_refresh_detected') badges.push('<span class="badge bg-info">Meta Refresh</span>');
    if (step.jsIndicators?.length) badges.push('<span class="badge bg-warning text-dark">JS Indicator (static)</span>');

    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <strong>Hop ${step.hop}</strong> ${status} ${badges.join(' ')}
          <div class="url-text mt-1">${escapeHtml(step.url)}</div>
          ${step.location ? `<small class="text-muted">→ ${escapeHtml(step.location)}</small>` : ''}
          ${step.error ? `<div class="text-danger small mt-1">${escapeHtml(step.error)}</div>` : ''}
          ${step.note ? `<div class="text-muted small mt-1">${escapeHtml(step.note)}</div>` : ''}
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  const labels = data.chain.map(s => `Hop ${s.hop}`);
  const statuses = data.chain.map(s => s.status || 0);
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('chainChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'HTTP Status',
        data: statuses,
        backgroundColor: statuses.map(s => s >= 300 && s < 400 ? '#0dcaf0' : s >= 400 ? '#dc3545' : '#198754')
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 500 } } }
  });

  const warnEl = document.getElementById('warnings');
  if (data.warnings && data.warnings.length) {
    warnEl.classList.remove('d-none');
    warnEl.innerHTML = '<strong>Warnings:</strong><ul class="mb-0">' + data.warnings.map(w => `<li>Hop ${w.hop}: ${escapeHtml(w.message)}</li>`).join('') + '</ul>';
  } else {
    warnEl.classList.add('d-none');
  }
}

document.getElementById('exportJson').addEventListener('click', () => {
  if (!currentResult) return;
  download(JSON.stringify(currentResult, null, 2), 'redirect-chain.json', 'application/json');
});

document.getElementById('exportCsv').addEventListener('click', () => {
  if (!currentResult) return;
  const rows = [['Hop', 'URL', 'Status', 'Type', 'Location', 'DomainChanged', 'Error']];
  currentResult.chain.forEach(s => {
    rows.push([s.hop, s.url, s.status || '', s.type || '', s.location || '', s.domainChanged ? 'yes' : 'no', s.error || '']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  download(csv, 'redirect-chain.csv', 'text/csv');
});

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadHistory() {
  try {
    const res = await fetch('/api/scans');
    const data = await res.json();
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = data.scans.map(s => `
      <tr>
        <td>${s.id}</td>
        <td class="text-truncate" style="max-width:280px" title="${escapeHtml(s.original_url)}">${escapeHtml(s.original_url)}</td>
        <td>${s.total_hops}</td>
        <td>${s.has_loop ? '<span class="badge bg-danger">Yes</span>' : 'No'}</td>
        <td>${new Date(s.created_at).toLocaleString()}</td>
        <td><button class="btn btn-sm btn-outline-danger" onclick="deleteScan(${s.id})">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">No scans yet</td></tr>';
  } catch {}
}

async function deleteScan(id) {
  if (!confirm('Delete this scan?')) return;
  await fetch(`/api/scans/${id}`, { method: 'DELETE' });
  loadHistory();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

loadHistory();

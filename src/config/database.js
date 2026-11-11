const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/scans.json');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

function load() {
  try {
    if (!fs.existsSync(dbPath)) return { scans: [], nextId: 1 };
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return { scans: [], nextId: 1 };
  }
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function saveScan(result) {
  const data = load();
  const scanId = data.nextId++;
  const scan = {
    id: scanId,
    original_url: result.originalUrl,
    final_url: result.finalUrl,
    total_hops: result.totalHops,
    has_loop: result.hasLoop ? 1 : 0,
    has_external: result.hasExternal ? 1 : 0,
    status: 'completed',
    created_at: new Date().toISOString(),
    analysis_json: JSON.stringify(result),
    steps: result.chain.map(s => ({
      hop: s.hop,
      url: s.url,
      status: s.status,
      type: s.type,
      location: s.location || null,
      resolved_ip: s.resolvedIp || null,
      domain_changed: s.domainChanged ? 1 : 0,
      is_shortener: s.isShortener ? 1 : 0,
      is_google_share: s.isGoogleShare ? 1 : 0,
      error: s.error || null,
      meta_refresh: s.metaRefresh || null,
      js_indicators: s.jsIndicators ? JSON.stringify(s.jsIndicators) : null
    }))
  };
  data.scans.unshift(scan);
  if (data.scans.length > 500) data.scans = data.scans.slice(0, 500);
  save(data);
  return scanId;
}

function getScans(limit = 50) {
  const data = load();
  return data.scans.slice(0, limit).map(s => ({
    id: s.id,
    original_url: s.original_url,
    final_url: s.final_url,
    total_hops: s.total_hops,
    has_loop: s.has_loop,
    has_external: s.has_external,
    created_at: s.created_at
  }));
}

function getScan(id) {
  const data = load();
  const scan = data.scans.find(s => s.id === id);
  if (!scan) return null;
  try { scan.analysis = JSON.parse(scan.analysis_json); } catch {}
  return scan;
}

function deleteScan(id) {
  const data = load();
  const before = data.scans.length;
  data.scans = data.scans.filter(s => s.id !== id);
  if (data.scans.length < before) {
    save(data);
    return true;
  }
  return false;
}

module.exports = { saveScan, getScans, getScan, deleteScan };

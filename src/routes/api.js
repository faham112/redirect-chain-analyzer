const express = require('express');
const rateLimit = require('express-rate-limit');
const { followRedirects } = require('../services/analyzer');
const { saveScan, getScans, getScan, deleteScan } = require('../config/database');
const { validateUrl } = require('../services/security');

const router = express.Router();

const analyzeLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

router.post('/analyze', analyzeLimiter, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    validateUrl(url);

    const result = await followRedirects(url);
    const scanId = saveScan(result);

    res.json({
      success: true,
      scanId,
      ...result
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Analysis failed' });
  }
});

router.get('/scans', (req, res) => {
  try {
    const scans = getScans(100);
    res.json({ success: true, scans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scans' });
  }
});

router.get('/scans/:id', (req, res) => {
  try {
    const scan = getScan(parseInt(req.params.id, 10));
    if (!scan) return res.status(404).json({ error: 'Scan not found' });
    res.json({ success: true, scan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scan' });
  }
});

router.delete('/scans/:id', (req, res) => {
  try {
    const deleted = deleteScan(parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Scan not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete scan' });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

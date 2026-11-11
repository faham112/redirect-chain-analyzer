# Redirect Chain Analyzer

A professional, security-focused web application that analyzes the complete HTTP redirect chain of any URL without automatically navigating the user to the destination.

## Features

- Manual HTTP redirect following (301, 302, 303, 307, 308)
- Meta refresh detection (static)
- JavaScript redirect indicators via static response inspection (never executed)
- URL shortener and Google share URL identification
- Redirect loop detection
- Maximum 10 redirects + 10-second timeout
- Full SSRF protection (private IPs, loopback, metadata endpoints, DNS rebinding protection)
- Scan history (JSON file store; schema mirrors scans + redirect_steps)
- JSON & CSV export
- Rate limiting
- Professional Bootstrap 5 dashboard with Chart.js visualization

## Security Controls

- Only HTTP/HTTPS allowed
- Restricted ports (default 80/443)
- Blocks localhost, private ranges, link-local, metadata IPs
- DNS resolution + revalidation on every hop
- No cookies or Authorization headers forwarded
- Response body size limited
- No automatic browser navigation to analyzed URLs

## Installation

```bash
cd redirect-chain-analyzer
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000

## API

- `POST /api/analyze` — `{ "url": "https://..." }`
- `GET /api/scans` — list recent scans
- `GET /api/scans/:id` — full scan details
- `DELETE /api/scans/:id` — delete scan
- `GET /api/health`

## Testing

```bash
npm test
```

## Database

Atomic JSON file store (`database/scans.json`) for zero native dependencies. Logical schema matches `scans` + embedded `redirect_steps`. Swap for SQLite/PostgreSQL in high-volume production without API changes.

## Disclaimer

This tool performs static analysis only. JavaScript-based redirects are detected through pattern matching and are **not** executed. Always verify final destinations independently for sensitive use cases.

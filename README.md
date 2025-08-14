# CVE Sync + UI

## Requirements
- Node.js 18+ (or 16+ with fetch polyfill)
- npm

## Install
1. copy `.env.example` to `.env` and edit if necessary.
2. `npm install`

## Run
- Development: `npm run dev` (requires nodemon)
- Production: `npm start`

The server exposes:
- UI: `http://localhost:3000/cves/list`
- API: `http://localhost:3000/api/cves`
- Single CVE: `http://localhost:3000/api/cves/CVE-1999-0334`
- Manual sync: `POST http://localhost:3000/admin/sync` (no auth in this demo)

## Tests
`npm test`

## Notes
- The sync job runs per `SYNC_CRON` in `.env` (default: every 6 hours).
- Database file is `cves.sqlite` (change `DB_FILE` in `.env`).
- The NVD API may rate-limit; consider adding an API key and respecting limits.
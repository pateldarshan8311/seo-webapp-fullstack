# SEO Audit Web Application

A modular SEO audit tool built with React + Vite on the frontend and Node.js + Express on the backend. It supports sitemap crawling, automatic internal-link crawling, manual URL lists, authenticated sessions, advanced SEO issue detection, local result persistence, and export to CSV/JSON.

## Project Structure

```text
backend/
  auth/
  crawler/
  data/audits/
  routes/
  seo/
  utils/
  server.js

frontend/
  src/
    components/
    pages/
    services/
    utils/
```

## Setup

```bash
cd "/media/troo/Data/2026/Seo WebApp/backend"
npm install

cd "/media/troo/Data/2026/Seo WebApp/frontend"
npm install
```

## Run Locally

Backend:

```bash
cd "/media/troo/Data/2026/Seo WebApp/backend"
npm run dev
```

Frontend:

```bash
cd "/media/troo/Data/2026/Seo WebApp/frontend"
npm run dev
```

The frontend defaults to `http://localhost:5173` and calls the backend at `http://localhost:4000/api`.

## Environment

Copy `backend/.env.example` to `backend/.env` if you want to override defaults.

## Notes

- Audit results are stored locally in `backend/data/audits`.
- Puppeteer is used for login flows and optional JavaScript rendering.
- Crawl pause/resume is handled in-memory per running job.
- Large sites are processed with concurrency controls, URL deduplication, and rate limiting.


# CensusSense

CensusSense is a chat-first Census research assistant for county-level questions across U.S. states and territories. The browser sends plain-English questions to a local Node adapter. The adapter interprets with Ollama or a deterministic fallback, validates approved intents, and keeps calculation and evidence generation in application code.

## Run

```powershell
npm install
npm run dev
```

Before starting the server, create a local `.env` file from `.env.example` and set the Census key supplied to your team:

```powershell
Copy-Item .env.example .env
# Edit .env and set CENSUS_API_KEY
npm run dev
```

Open http://localhost:5173.

`npm run build` compiles the server and builds the Vite client. `npm test` runs the deterministic unit tests.

## Runtime notes

The server loads `CENSUS_API_KEY` from `.env` and sends it only from the server to the Census API. It resolves the requested state to its Census FIPS code and queries approved ACS 5-year variables; no key or arbitrary variable selection reaches the browser. The source request URL and catalog metadata remain visible in the evidence panel. Never commit `.env` or paste the key into frontend code.

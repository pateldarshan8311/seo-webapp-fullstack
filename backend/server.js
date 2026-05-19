const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const AuditRepository = require("./db/auditRepository");
const AuditService = require("./crawler/auditService");
const createAuditRouter = require("./routes/auditRoutes");

dotenv.config();

function buildAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_ORIGIN,
    ...(process.env.CORS_ALLOWED_ORIGINS || "").split(","),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ]
    .map((origin) => String(origin || "").trim())
    .filter(Boolean);

  return new Set(configuredOrigins);
}

function allowNetlifyPreviewOrigin(origin) {
  if (process.env.ALLOW_NETLIFY_PREVIEW_ORIGINS !== "true") {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === "https:" && parsedOrigin.hostname.endsWith(".netlify.app");
  } catch (_error) {
    return false;
  }
}

async function startServer() {
  const app = express();
  const host = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT) || 4000;
  const allowedOrigins = buildAllowedOrigins();
  const auditRepository = new AuditRepository();

  await auditRepository.connect();

  const auditService = new AuditService(auditRepository);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin) || allowNetlifyPreviewOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      storage: auditRepository.getMode(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", createAuditRouter(auditService));

  app.use((error, _request, response, _next) => {
    const status = error.status || 500;
    response.status(status).json({
      message: error.message || "Unexpected server error",
    });
  });

  app.listen(port, host, () => {
    console.log(`SEO audit backend listening on http://${host}:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend server", error);
  process.exit(1);
});

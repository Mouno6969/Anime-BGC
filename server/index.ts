import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { handleApi, handleProxy } from "./api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ---- JSON API (AniList + Miruro) -----------------------------------------
  app.use("/api", async (req, res) => {
    try {
      const fullUrl = `/api${req.url ?? ""}`;
      // Binary stream proxy (m3u8 / segments) takes priority.
      const proxied = await handleProxy(fullUrl, req.headers.range);
      if (proxied) {
        res.status(proxied.status);
        for (const [k, v] of Object.entries(proxied.headers)) res.setHeader(k, v);
        res.end(proxied.body);
        return;
      }
      const result = await handleApi(req.method ?? "GET", fullUrl);
      if (!result) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(result.status);
      res.setHeader("Cache-Control", "no-store");
      res.json(result.body);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

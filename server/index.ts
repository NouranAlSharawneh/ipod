import express from "express";
import library from "./routes/library.js";
import player from "./routes/player.js";
import artwork from "./routes/artwork.js";
import system from "./routes/system.js";

const app = express();
app.use(express.json());

// The bridge only binds to localhost; allow any origin so the Tauri webview
// (tauri://localhost) and the Vite dev server can both call it.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use("/api/library", library);
app.use("/api/player", player);
app.use("/api/artwork", artwork);
app.use("/api/system", system);

app.use((err: unknown, _req: express.Request, res: express.Response) => {
  console.error("[bridge]", err);
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, "127.0.0.1", () => {
  console.log(`[bridge] listening on http://127.0.0.1:${port}`);
});

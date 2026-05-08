import express from "express";
import library from "./routes/library.js";
import player from "./routes/player.js";
import artwork from "./routes/artwork.js";

const app = express();
app.use(express.json());

app.use("/api/library", library);
app.use("/api/player", player);
app.use("/api/artwork", artwork);

app.use((err: unknown, _req: express.Request, res: express.Response) => {
  console.error("[bridge]", err);
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`[bridge] listening on http://localhost:${port}`);
});

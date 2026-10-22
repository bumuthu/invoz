import { createServer } from "node:http";
import { dispatchHttp } from "./app";

const port = Number(process.env.PORT || 3003);

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = Array.isArray(value) ? value.join(",") : value;
  }
  const result = await dispatchHttp({
    method: (req.method || "GET").toUpperCase(),
    path: url.pathname,
    headers,
    rawBody: Buffer.concat(chunks).toString("utf8"),
  });
  res.writeHead(result.statusCode, result.headers);
  res.end(result.body);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`landing-service http://127.0.0.1:${port}`);
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const docsHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>RAMIS Web API Mock Engine</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: new URL("/openapi.yaml", window.location.origin).href,
      dom_id: "#swagger-ui"
    });
  </script>
</body>
</html>
`;

function openApiPath(): string | undefined {
  const entry = process.argv[1] ? path.dirname(process.argv[1]) : "";
  const candidates = [
    entry && path.join(entry, "openapi.yaml"),
    entry && path.join(entry, "../openapi.yaml"),
    path.join(process.cwd(), "openapi.yaml"),
    path.join(process.cwd(), "tools/ramis-engine/openapi.yaml"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => existsSync(candidate));
}

export function openApiDocument(): string {
  const file = openApiPath();
  if (!file) throw new Error("openapi.yaml was not found beside the engine");
  return readFileSync(file, "utf8");
}

export function docsPage(): string {
  return docsHtml;
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export function openApiDocument(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = [path.join(here, "../openapi.yaml"), path.join(here, "openapi.yaml")].find((candidate) =>
    existsSync(candidate),
  );
  if (!file) throw new Error("openapi.yaml was not found beside the engine");
  return readFileSync(file, "utf8");
}

export function docsPage(): string {
  return docsHtml;
}

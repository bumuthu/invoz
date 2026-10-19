import { createApp } from "./server";
import { settingsFromEnv } from "./settings";

const settings = settingsFromEnv();
const { server } = await createApp(settings);

server.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

server.listen(settings.port, settings.host, () => {
  console.log(`RAMIS mock engine listening on http://${settings.host}:${settings.port}`);
});

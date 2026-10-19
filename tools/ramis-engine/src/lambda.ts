import { fromApiGateway, toApiGateway } from "./gateway";
import { createApp, handleRequest, type App } from "./server";
import { settingsFromEnv } from "./settings";

let ready: Promise<App> | undefined;

export async function handler(event: unknown): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  try {
    ready ??= createApp(settingsFromEnv());
    const app = await ready;
    return toApiGateway(await handleRequest(app, fromApiGateway(event)));
  } catch (error) {
    console.error(error);
    ready = undefined;
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ code: "RAMIS_SCHEMA", message: "Unexpected mock engine failure" }),
    };
  }
}

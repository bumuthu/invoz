export type LandingRequest = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  json: unknown;
};

export type LandingResponse = {
  status: number;
  body: unknown;
};

export type RouteHandler = (request: LandingRequest) => Promise<LandingResponse>;

export type Route = {
  method: string;
  path: string;
  handle: RouteHandler;
};

export type HttpResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

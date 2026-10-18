export class Code {
  static readonly TIN = "RAMIS_ERR_001";
  static readonly SERIAL = "RAMIS_ERR_002";
  static readonly PERIOD = "RAMIS_ERR_003";
  static readonly SUPPLY_DATE = "RAMIS_ERR_004";
  static readonly MATH = "RAMIS_ERR_005";
  static readonly IMMUTABLE = "RAMIS_ERR_006";
  static readonly PARENT = "RAMIS_ERR_007";
  static readonly CREDIT_LIMIT = "RAMIS_ERR_008";
  static readonly THROTTLE = "RAMIS_ERR_009";
  static readonly OUTAGE = "RAMIS_ERR_010";
  static readonly SCHEMA = "RAMIS_SCHEMA";
  static readonly AUTH = "RAMIS_AUTH";
}

export class RamisError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    field?: string,
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "RamisError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.headers = headers;
  }
}

export function errorBody(error: RamisError): { code: string; message: string; field?: string } {
  const body: { code: string; message: string; field?: string } = {
    code: error.code,
    message: error.message,
  };
  if (error.field) body.field = error.field;
  return body;
}

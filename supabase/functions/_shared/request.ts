export class RequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

/** Read JSON with a hard byte ceiling before parsing user-controlled input. */
export async function readJsonBody<T>(
  request: Request,
  maxBytes = 128 * 1024,
): Promise<T> {
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestError("The request is too large.", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RequestError("The request is too large.", 413);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestError("The request body is not valid JSON.");
  }
}

export function safeErrorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

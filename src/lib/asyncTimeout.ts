export class OperationTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationTimeoutError";
  }
}

/**
 * Prevent a native bridge or network request from leaving the UI busy forever.
 * The underlying operation may still finish later; StoreKit transaction updates
 * are therefore still observed and reconciled after a purchase timeout.
 */
export function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new OperationTimeoutError(message)),
      timeoutMs,
    );
    operation.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

import pTimeout, { TimeoutError } from 'p-timeout';

/**
 * Wrap an async layer call with a strict timeout. On timeout we reject with
 * a typed `IPELayerTimeoutError` so the pipeline orchestrator can decide
 * fallback vs surface.
 */
export class IPELayerTimeoutError extends Error {
  public readonly layer: string;
  public readonly timeoutMs: number;
  public constructor(layer: string, timeoutMs: number) {
    super(`IPE layer "${layer}" exceeded ${timeoutMs}ms timeout`);
    this.name = 'IPELayerTimeoutError';
    this.layer = layer;
    this.timeoutMs = timeoutMs;
  }
}

export async function withTimeout<T>(
  layer: string,
  timeoutMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await pTimeout(fn(), {
      milliseconds: timeoutMs,
      message: `IPE layer "${layer}" exceeded ${timeoutMs}ms timeout`,
    });
  } catch (err) {
    if (err instanceof TimeoutError) {
      throw new IPELayerTimeoutError(layer, timeoutMs);
    }
    throw err;
  }
}

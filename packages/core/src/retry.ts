export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  onAttempt?: (attempt: number) => Promise<void> | void;
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await options.onAttempt?.(attempt);
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function anySignal(signals: Array<AbortSignal | undefined | null>): AbortSignal | undefined {
  const valid = signals.filter(Boolean) as AbortSignal[]
  if (valid.length === 0) return undefined
  if (valid.length === 1) return valid[0]

  const controller = new AbortController()

  const onAbort = (event: Event) => {
    const source = event.target as AbortSignal
    controller.abort(source.reason)
    cleanup()
  }

  const cleanup = () => {
    for (const signal of valid) {
      signal.removeEventListener("abort", onAbort)
    }
  }

  for (const signal of valid) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener("abort", onAbort, { once: true })
  }

  return controller.signal
}

export class RequestTimeoutError extends Error {
  constructor(message = "Request timeout") {
    super(message)
    this.name = "RequestTimeoutError"
  }
}

export function isRequestTimeoutError(error: unknown): error is RequestTimeoutError {
  return error instanceof RequestTimeoutError || (error instanceof Error && error.name === "RequestTimeoutError")
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    timeoutController.abort(new DOMException("Request timeout", "AbortError"))
  }, timeoutMs)

  try {
    const signal = anySignal([init.signal as AbortSignal | undefined, timeoutController.signal])
    return await fetch(input, { ...init, signal })
  } catch (error: unknown) {
    if (timedOut) {
      throw new RequestTimeoutError(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

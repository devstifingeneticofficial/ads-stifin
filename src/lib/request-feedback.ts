import { toast } from "sonner"
import { isRequestTimeoutError } from "@/lib/fetch-timeout"

type RequestErrorOptions = {
  timeoutMessage?: string
  errorMessage?: string
  showErrorToast?: boolean
  showTimeoutToast?: boolean
}

export function handleRequestError(error: unknown, options: RequestErrorOptions = {}) {
  const {
    timeoutMessage = "Koneksi lambat. Permintaan timeout, coba lagi.",
    errorMessage = "Terjadi kesalahan saat memuat data.",
    showErrorToast = true,
    showTimeoutToast = true,
  } = options

  if ((error as any)?.name === "AbortError") {
    return "abort" as const
  }

  if (isRequestTimeoutError(error)) {
    if (showTimeoutToast) {
      toast.warning(timeoutMessage)
    }
    return "timeout" as const
  }

  if (showErrorToast) {
    toast.error(errorMessage)
  }
  return "error" as const
}

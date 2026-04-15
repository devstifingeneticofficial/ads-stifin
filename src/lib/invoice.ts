export type InvoiceKind = "GAJI_KREATOR" | "BONUS_ADVERTISER"

const pad = (value: number) => String(value).padStart(2, "0")

export const buildInvoiceNumber = (
  kind: InvoiceKind,
  batchId: string,
  payoutDate: Date | string
) => {
  const date = new Date(payoutDate)
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const prefix = kind === "GAJI_KREATOR" ? "GK" : "BA"
  const suffix = batchId.slice(-6).toUpperCase()
  return `${prefix}-${yyyy}${mm}${dd}-${suffix}`
}


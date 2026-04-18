const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function buildCampaignCode(length = 6): string {
  let output = ""
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHANUM.length)
    output += ALPHANUM[index]
  }
  return output
}

export function formatCampaignDateID(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  })
}

export function buildCampaignName(input: {
  city: string
  startDate: Date
  promotorName: string
  campaignCode?: string | null
}): string {
  const base = `${input.city} ${formatCampaignDateID(input.startDate)} - ${input.promotorName}`
  return input.campaignCode ? `${base} [${input.campaignCode}]` : base
}


export const USER_ENABLED_SETTING_KEY = "managed_user_enabled_map"

export const parseUserEnabledMap = (raw: string | null | undefined): Record<string, boolean> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export const isUserEnabled = (map: Record<string, boolean>, userId: string): boolean =>
  map[userId] !== false


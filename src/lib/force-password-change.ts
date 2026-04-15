export const FORCE_PASSWORD_CHANGE_KEY = "force_password_change_users"

export const parseForcePasswordChangeMap = (
  raw: string | null | undefined
): Record<string, boolean> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export const mustChangePassword = (
  map: Record<string, boolean>,
  userId: string
): boolean => map[userId] === true


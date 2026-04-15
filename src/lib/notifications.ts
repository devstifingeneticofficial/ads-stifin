import { db } from "@/lib/db"
import { USER_ENABLED_SETTING_KEY, isUserEnabled, parseUserEnabledMap } from "@/lib/user-enabled"

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string
) {
  return db.notification.create({
    data: { userId, title, message, type, link },
  })
}

export async function notifyRole(
  role: string,
  title: string,
  message: string,
  type: string,
  link?: string
) {
  const [users, setting] = await Promise.all([
    db.user.findMany({ where: { role } }),
    db.systemSetting.findUnique({ where: { key: USER_ENABLED_SETTING_KEY } }),
  ])
  const enabledMap = parseUserEnabledMap(setting?.value)
  const enabledUsers = users.filter((user) => isUserEnabled(enabledMap, user.id))
  for (const user of enabledUsers) {
    await createNotification(user.id, title, message, type, link)
  }
}

export async function notifyStifin(
  title: string,
  message: string,
  type: string
) {
  return notifyRole("STIFIN", title, message, type)
}

import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"

const DEV_FALLBACK_SECRET = "stifin-dev-secret-key-only-for-local"
const SESSION_MAX_AGE_DAYS = Number(process.env.AUTH_SESSION_DAYS || "180")
let hasWarnedMissingSecret = false

function getJwtSecret() {
  const configuredSecret = process.env.NEXTAUTH_SECRET
  if (configuredSecret) return configuredSecret

  if (process.env.NODE_ENV === "production" && !hasWarnedMissingSecret) {
    hasWarnedMissingSecret = true
    console.error(
      "[AUTH] NEXTAUTH_SECRET tidak terdeteksi. Menggunakan fallback secret sementara. " +
        "Segera set NEXTAUTH_SECRET di environment Cloudflare agar sesi aman.",
    )
  }

  return DEV_FALLBACK_SECRET
}

export const AUTH_COOKIE_NAME = "auth-token"
export const AUTH_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60

export interface JWTPayload {
  id: string
  email: string
  name: string
  role: string
  city?: string | null
  actorId?: string
  actorEmail?: string
  actorName?: string
  actorRole?: string
  isActingAs?: boolean
}

export async function login(email: string, password: string): Promise<JWTPayload | null> {
  try {
    const { PrismaClient } = await import("@prisma/client")
    const globalForPrisma = globalThis as unknown as { prisma: any }
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = new PrismaClient()
    }
    const user = await globalForPrisma.prisma.user.findUnique({ where: { email } })
    if (!user) return null

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      city: user.city,
    }
  } catch (error) {
    console.error("[AUTH] Login error:", error)
    return null
  }
}

export function createToken(payload: JWTPayload): string {
  return jwt.sign({ ...payload }, getJwtSecret(), { expiresIn: `${SESSION_MAX_AGE_DAYS}d` })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

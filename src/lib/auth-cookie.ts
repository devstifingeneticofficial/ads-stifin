import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS, JWTPayload, createToken } from "@/lib/auth"

export function attachAuthCookie(response: NextResponse, payload: JWTPayload) {
  response.cookies.set(AUTH_COOKIE_NAME, createToken(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  })
}


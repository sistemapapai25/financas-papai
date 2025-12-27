import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPublicAppUrl() {
  const env = import.meta.env as unknown as Record<string, string | undefined>
  const configured =
    env.VITE_PUBLIC_APP_URL ??
    env.VITE_PUBLIC_URL ??
    env.VITE_APP_URL ??
    env.VITE_SITE_URL

  const trimmed = (configured ?? "").trim()
  if (trimmed) return trimmed.replace(/\/+$/, "")
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

export function makePublicUrl(pathname: string) {
  const base = getPublicAppUrl()
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`
  if (!base) return normalized
  return new URL(normalized, base).toString()
}

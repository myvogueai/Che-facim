// router.js — route guard e redirect centralizzati.
// Riferimento: ADR-001 Fase 1 (auth-only); altri tipi in Fase 2+.

import { waitForAuth, getCurrentUser, getUserProfile } from "./auth.js";

export const ROUTES = {
  "/auth/login.html": { type: "auth-only" },
  "/auth/register.html": { type: "auth-only" }
};

const ALLOWED_RETURN_PATHS = [
  "/index.html",
  "/evento.html",
  "/preferiti.html",
  "/i-miei-eventi.html",
  "/about.html"
];

export function redirect(url) {
  window.location.replace(url);
}

function normalizePath(pathname) {
  if (pathname === "/" || pathname === "") return "/index.html";
  return pathname.endsWith("/") && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
}

export function sanitizeReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== "string") return null;

  const trimmed = returnTo.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://") || trimmed.toLowerCase().startsWith("javascript:")) return null;

  const base = trimmed.split("?")[0].split("#")[0];
  const allowed = ALLOWED_RETURN_PATHS.some(
    (p) => base === p || base.endsWith(p)
  );
  if (!allowed) return null;

  if (base === "/auth/login.html" || base === "/auth/register.html") return null;

  return trimmed;
}

export function getPostLoginRedirect(profile, returnTo) {
  if (profile?.status === "suspended") {
    return null;
  }

  const user = getCurrentUser();
  if (!user?.emailVerified) {
    return null;
  }

  if (profile?.role === "admin") {
    return "/admin/index.html";
  }

  const safeReturn = sanitizeReturnTo(returnTo);
  if (safeReturn && profile?.role !== "admin") {
    return safeReturn;
  }

  return "/index.html";
}

export async function guard(pageConfig) {
  await waitForAuth();
  const user = getCurrentUser();
  const type = pageConfig?.type || "public";

  if (type === "auth-only") {
    if (!user) return true;

    const profile = await getUserProfile();
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");

    if (!user.emailVerified) {
      return true;
    }

    const destination = getPostLoginRedirect(profile, returnTo);
    if (destination) {
      redirect(destination);
      return false;
    }

    return true;
  }

  return true;
}

export function getPageConfig() {
  const path = normalizePath(window.location.pathname);
  if (ROUTES[path]) return ROUTES[path];

  const file = path.split("/").pop() || "index.html";
  const key = Object.keys(ROUTES).find((r) => r.endsWith("/" + file));
  return key ? ROUTES[key] : { type: "public" };
}

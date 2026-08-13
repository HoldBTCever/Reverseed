import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

const ADMIN_PREFIX = "/admin";
const CLIENT_PREFIXES = ["/onboarding", "/imoveis", "/perfil"];
const GUEST_ONLY = ["/entrar", "/cadastro"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isClientRoute = CLIENT_PREFIXES.some((p) => pathname.startsWith(p));
  const isGuestOnlyRoute = GUEST_ONLY.some((p) => pathname.startsWith(p));

  if (isAdminRoute) {
    if (!session) {
      const url = new URL("/entrar", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/imoveis", request.url));
    }
  }

  if (isClientRoute) {
    if (!session) {
      const url = new URL("/entrar", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role !== "CLIENT") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (isGuestOnlyRoute && session) {
    return NextResponse.redirect(
      new URL(session.role === "ADMIN" ? "/admin" : "/imoveis", request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/onboarding/:path*",
    "/imoveis/:path*",
    "/perfil/:path*",
    "/entrar",
    "/cadastro",
  ],
};

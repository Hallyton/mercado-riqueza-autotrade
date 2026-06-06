import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { isInternalRoute } from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/planos",
  "/cadastro",
  "/autotrade",
  "/mr-fibo-d1-guard",
  "/termos/autotrade",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/termos/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/commercial/signup") return true;
  if (pathname === "/api/webhooks/billing") return true;
  if (pathname.startsWith("/api/billing/webhook/")) return true;
  if (pathname === "/api/v1/ea/activate") return true;
  if (pathname.startsWith("/api/v1/ea")) return true;
  if (pathname === "/api/master/signals") return true;
  return false;
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const appRole = session?.user?.appRole;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && isLoggedIn) {
      const dest = appRole === "ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(dest, nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isInternalRoute(pathname) && appRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (pathname.startsWith("/admin")) {
    if (appRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (appRole !== "CLIENT") {
      return NextResponse.redirect(new URL("/admin", nextUrl));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin") && appRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

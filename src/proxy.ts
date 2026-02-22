/**
 * Next.js proxy (formerly middleware) — protects authenticated routes.
 *
 * Protected:
 *   - /dashboard (and all sub-paths)
 *   - /onboarding (and all sub-paths)
 *   - /api/* except /api/auth/*
 *
 * Unauthenticated requests are redirected to / (for pages)
 * or return 401 JSON (for API routes).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";

const COOKIE_NAME = "hermes_session";

export async function proxy(req: NextRequest): Promise<NextResponse> {
    const { pathname } = req.nextUrl;

    // Allow all auth routes through
    if (pathname.startsWith("/api/auth/")) {
        return NextResponse.next();
    }

    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? await verifySession(token) : null;

    // Protect API routes (non-auth)
    if (pathname.startsWith("/api/")) {
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.next();
    }

    // Protect page routes
    const protectedPages = ["/dashboard", "/onboarding"];
    const isProtected = protectedPages.some((p) => pathname.startsWith(p));

    if (isProtected && !session) {
        const url = req.nextUrl.clone();
        url.pathname = "/";
        url.searchParams.set("error", "unauthenticated");
        return NextResponse.redirect(url);
    }

    // If already logged in and visiting /, redirect to dashboard
    if (pathname === "/" && session) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};

/**
 * GET /api/auth/strava/callback
 *
 * Handles the OAuth callback from Strava:
 * 1. Validates signed state token (CSRF check)
 * 2. Exchanges code for tokens
 * 3. Upserts User record in DB
 * 4. Sets session cookie and redirects to /onboarding or /dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/auth/strava";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

function getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
    }
    return secret;
}

async function verifyState(state: string): Promise<boolean> {
    const dotIndex = state.indexOf(".");
    if (dotIndex === -1) return false;

    const nonce = state.slice(0, dotIndex);
    const sig = state.slice(dotIndex + 1);

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(getSessionSecret()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
    );

    const sigBuf = Buffer.from(sig, "hex");
    return crypto.subtle.verify(
        "HMAC",
        key,
        sigBuf,
        enc.encode(nonce)
    );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { searchParams } = new URL(req.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    console.log("[strava/callback] ===== CALLBACK HIT =====");
    console.log("[strava/callback] code:", code ? `${code.slice(0, 8)}...` : "(missing)");
    console.log("[strava/callback] state:", state ? `${state.slice(0, 20)}...` : "(missing)");
    console.log("[strava/callback] error:", error ?? "(none)");

    // User denied access
    if (error) {
        console.log("[strava/callback] User denied access");
        return NextResponse.redirect(`${appUrl}/?error=access_denied`);
    }

    if (!code) {
        console.log("[strava/callback] No code in callback");
        return NextResponse.redirect(`${appUrl}/?error=missing_code`);
    }

    // CSRF state validation — verify the HMAC signature on the state token
    if (!state || !(await verifyState(state))) {
        console.error("[strava/callback] State verification FAILED");
        return NextResponse.redirect(`${appUrl}/?error=invalid_state`);
    }
    console.log("[strava/callback] ✓ State verified OK");

    try {
        // Exchange code for tokens
        console.log("[strava/callback] Exchanging code for tokens...");
        const tokenData = await exchangeCode(code);
        const { access_token, refresh_token, expires_at, athlete } = tokenData;
        console.log("[strava/callback] ✓ Token exchange OK, athlete:", athlete.id, athlete.firstname);

        // Upsert user in DB
        console.log("[strava/callback] Upserting user in DB...");
        const user = await prisma.user.upsert({
            where: { stravaId: BigInt(athlete.id) },
            update: {
                refreshToken: refresh_token,
                accessToken: access_token,
                accessTokenExpiresAt: new Date(expires_at * 1000),
                stravaUsername: athlete.username ?? undefined,
            },
            create: {
                stravaId: BigInt(athlete.id),
                stravaUsername: athlete.username ?? undefined,
                refreshToken: refresh_token,
                accessToken: access_token,
                accessTokenExpiresAt: new Date(expires_at * 1000),
            },
        });
        console.log("[strava/callback] ✓ User upserted, userId:", user.id);

        // Determine redirect: new users go to onboarding, returning users to dashboard
        const hasProfile = await prisma.runnerProfile.findUnique({
            where: { userId: user.id },
            select: { id: true },
        });
        const redirectUrl = `${appUrl}${hasProfile ? "/dashboard" : "/onboarding"}`;
        console.log("[strava/callback] ✓ Redirect target:", redirectUrl);

        const response = NextResponse.redirect(redirectUrl);
        await setSessionCookie(response, {
            userId: user.id,
            stravaId: String(athlete.id),
            stravaUsername: athlete.username ?? undefined,
        });
        console.log("[strava/callback] ✓ Session cookie set, redirecting to:", redirectUrl);

        return response;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[strava/callback] ✗ ERROR:", msg);
        return NextResponse.redirect(`${appUrl}/?error=${encodeURIComponent(msg)}`);
    }
}

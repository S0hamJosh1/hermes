/**
 * JWT session management using Web Crypto API (no external deps).
 *
 * Sessions are stored as signed JWTs in an HttpOnly cookie named `hermes_session`.
 * The JWT is signed with HMAC-SHA256 using SESSION_SECRET from env.
 *
 * Payload: { userId: string, stravaId: string, iat: number, exp: number }
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "hermes_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
    userId: string;
    stravaId: string;
    stravaUsername?: string;
    iat: number;
    exp: number;
};

// ─── Crypto helpers ──────────────────────────────────────────────────────────

function getSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
    }
    return secret;
}

async function getKey(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

function base64url(data: ArrayBuffer | Uint8Array): string {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return Buffer.from(bytes)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4;
    return Buffer.from(pad ? padded + "=".repeat(4 - pad) : padded, "base64").toString("utf-8");
}

// ─── JWT sign / verify ───────────────────────────────────────────────────────

export async function signSession(
    payload: Omit<SessionPayload, "iat" | "exp">
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: SessionPayload = {
        ...payload,
        iat: now,
        exp: now + SESSION_DURATION_SECONDS,
    };

    const enc = new TextEncoder();
    const header = base64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const body = base64url(enc.encode(JSON.stringify(fullPayload)));
    const signingInput = `${header}.${body}`;

    const key = await getKey(getSecret());
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));

    return `${signingInput}.${base64url(sig)}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const [header, body, sig] = parts;
        const signingInput = `${header}.${body}`;

        const enc2 = new TextEncoder();
        const key = await getKey(getSecret());
        const sigBuf = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        const sigBytes = new Uint8Array(sigBuf.buffer, sigBuf.byteOffset, sigBuf.byteLength);
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            sigBytes,
            enc2.encode(signingInput)
        );
        if (!valid) return null;

        const payload = JSON.parse(base64urlDecode(body)) as SessionPayload;
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;

        return payload;
    } catch {
        return null;
    }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

/**
 * Read and verify the session from the incoming request cookies.
 * Use this in API route handlers.
 */
export async function getSessionFromRequest(
    req: NextRequest
): Promise<SessionPayload | null> {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
}

/**
 * Read and verify the session from Next.js server component cookies().
 * Use this in Server Components and Server Actions.
 */
export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
}

/**
 * Set the session cookie on a NextResponse.
 */
export async function setSessionCookie(
    response: NextResponse,
    payload: Omit<SessionPayload, "iat" | "exp">
): Promise<NextResponse> {
    const token = await signSession(payload);
    response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_DURATION_SECONDS,
    });
    return response;
}

/**
 * Clear the session cookie on a NextResponse.
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
    response.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}

/**
 * GET /api/auth/strava
 *
 * Redirects the user to Strava's OAuth authorization page.
 * Uses a signed HMAC state token for CSRF protection (no cookie needed).
 */

import { NextResponse } from "next/server";
import { getStravaAuthUrl } from "@/lib/auth/strava";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }
  return secret;
}

async function signState(nonce: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(nonce)
  );
  const sig = Buffer.from(sigBuf).toString("hex");
  // state = nonce.signature  (both hex strings)
  return `${nonce}.${sig}`;
}

export async function GET(): Promise<NextResponse> {
  // Generate a random nonce
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Buffer.from(nonceBytes).toString("hex");

  // Sign the nonce so we can verify it on callback without needing a cookie
  const state = await signState(nonce);

  const authUrl = getStravaAuthUrl(state);

  // Simple redirect — no intermediate HTML page needed since we're not
  // relying on a cookie being set before the redirect.
  return NextResponse.redirect(authUrl);
}

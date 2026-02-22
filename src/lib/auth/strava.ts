/**
 * Strava API helpers.
 *
 * Covers:
 *   - Building the OAuth authorization URL
 *   - Exchanging an auth code for tokens
 *   - Refreshing an expired access token
 *   - Fetching recent activities
 */

const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StravaTokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_at: number; // Unix timestamp
    token_type: string;
    athlete: StravaAthlete;
};

export type StravaRefreshResponse = {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: string;
};

export type StravaAthlete = {
    id: number;
    username: string | null;
    firstname: string;
    lastname: string;
    profile: string; // avatar URL
};

export type StravaActivity = {
    id: number;
    name: string;
    type: string;
    sport_type: string;
    distance: number;          // meters
    moving_time: number;       // seconds
    elapsed_time: number;      // seconds
    total_elevation_gain: number;
    start_date: string;        // ISO 8601 UTC
    start_date_local: string;  // ISO 8601 local
    average_speed: number;     // m/s
    max_speed: number;         // m/s
    average_heartrate?: number;
    max_heartrate?: number;
    weighted_average_watts?: number;
    external_id?: string;
    upload_id?: number;
};

// ─── OAuth URL builder ───────────────────────────────────────────────────────

/**
 * Build the Strava OAuth authorization URL.
 * Scopes: activity:read_all gives us all activities including private ones.
 */
export function getStravaAuthUrl(state?: string): string {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        throw new Error("STRAVA_CLIENT_ID and STRAVA_REDIRECT_URI must be set in env.");
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        approval_prompt: "auto",
        scope: "activity:read_all",
        ...(state ? { state } : {}),
    });

    return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

// ─── Token exchange ──────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called once after the user authorizes the app.
 */
export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in env.");
    }

    const res = await fetch(STRAVA_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Strava token exchange failed: ${res.status} ${body}`);
    }

    return res.json() as Promise<StravaTokenResponse>;
}

// ─── Token refresh ───────────────────────────────────────────────────────────

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
    refreshToken: string
): Promise<StravaRefreshResponse> {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in env.");
    }

    const res = await fetch(STRAVA_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Strava token refresh failed: ${res.status} ${body}`);
    }

    return res.json() as Promise<StravaRefreshResponse>;
}

// ─── Activity fetching ───────────────────────────────────────────────────────

/**
 * Fetch recent activities from Strava.
 *
 * @param accessToken - Valid (non-expired) access token
 * @param after - Unix timestamp; only return activities after this time
 * @param perPage - Max activities to fetch (Strava max: 200)
 */
export async function fetchStravaActivities(
    accessToken: string,
    after?: number,
    perPage = 100
): Promise<StravaActivity[]> {
    const params = new URLSearchParams({
        per_page: String(Math.min(perPage, 200)),
        ...(after ? { after: String(after) } : {}),
    });

    const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Strava activities fetch failed: ${res.status} ${body}`);
    }

    return res.json() as Promise<StravaActivity[]>;
}

// ─── Token freshness helper ───────────────────────────────────────────────────

/**
 * Returns true if the access token is still valid (with a 5-minute buffer).
 */
export function isTokenFresh(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    const bufferMs = 5 * 60 * 1000;
    return expiresAt.getTime() - bufferMs > Date.now();
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 * Updates the DB record if a refresh was needed.
 *
 * @param user - User record from DB (needs refreshToken, accessToken, accessTokenExpiresAt)
 * @param updateUser - Callback to persist new tokens to DB
 */
export async function getValidAccessToken(
    user: {
        accessToken: string | null;
        accessTokenExpiresAt: Date | null;
        refreshToken: string;
    },
    updateUser: (data: {
        accessToken: string;
        accessTokenExpiresAt: Date;
        refreshToken: string;
    }) => Promise<void>
): Promise<string> {
    if (user.accessToken && isTokenFresh(user.accessTokenExpiresAt)) {
        return user.accessToken;
    }

    // Refresh the token
    const refreshed = await refreshAccessToken(user.refreshToken);
    const newExpiry = new Date(refreshed.expires_at * 1000);

    await updateUser({
        accessToken: refreshed.access_token,
        accessTokenExpiresAt: newExpiry,
        refreshToken: refreshed.refresh_token,
    });

    return refreshed.access_token;
}

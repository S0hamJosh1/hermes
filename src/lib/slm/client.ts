/**
 * SLM Client — wraps Google Gemini API (free tier).
 *
 * Uses the REST API directly (no SDK dependency).
 * Requires GEMINI_API_KEY env var.
 * Model: configurable via GEMINI_MODEL env var.
 * Defaults to gemini-2.5-flash with automatic fallbacks.
 *
 * Handles rate limiting (429) with automatic retry and backoff.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 2000;
const DEFAULT_MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemma-3-4b-it",
];

function getApiKey(): string {
    return process.env.GEMINI_API_KEY ?? "";
}

function getModel(): string {
    return process.env.GEMINI_MODEL ?? DEFAULT_MODEL_CANDIDATES[0];
}

function getModelCandidates(preferred?: string): string[] {
    const first = preferred ?? getModel();
    const models = [first, ...DEFAULT_MODEL_CANDIDATES];
    return [...new Set(models)];
}

export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export type ChatResult = {
    ok: boolean;
    message?: string;
    error?: string;
    rateLimited?: boolean;
};

/**
 * Check if the Gemini API is configured and reachable.
 */
export async function checkHealth(): Promise<{
    online: boolean;
    model: string;
    available: boolean;
}> {
    const apiKey = getApiKey();
    const model = getModelCandidates()[0];

    if (!apiKey) {
        return { online: false, model, available: false };
    }

    try {
        const res = await fetch(
            `${GEMINI_BASE}/models/${model}?key=${apiKey}`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) {
            console.warn("[slm] Health check failed:", res.status);
            return { online: true, model, available: false };
        }
        return { online: true, model, available: true };
    } catch (err) {
        console.warn("[slm] Health check error:", err instanceof Error ? err.message : err);
        return { online: false, model, available: false };
    }
}

/**
 * Convert our ChatMessage format to Gemini API format.
 * Gemini uses "user" and "model" roles, and system instructions are separate.
 */
function toGeminiFormat(messages: ChatMessage[]): {
    systemInstruction?: { parts: { text: string }[] };
    contents: { role: string; parts: { text: string }[] }[];
} {
    const systemParts = messages
        .filter((m) => m.role === "system")
        .map((m) => ({ text: m.content }));

    const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

    return {
        ...(systemParts.length > 0
            ? { systemInstruction: { parts: systemParts } }
            : {}),
        contents,
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Add ±25% jitter to avoid thundering-herd retries */
function jitter(ms: number): number {
    return Math.round(ms * (0.75 + Math.random() * 0.5));
}

/**
 * Send a chat completion request to Gemini with automatic retry on 429.
 */
export async function chat(
    messages: ChatMessage[],
    options?: {
        temperature?: number;
        model?: string;
        timeoutMs?: number;
    }
): Promise<ChatResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { ok: false, error: "GEMINI_API_KEY not configured" };
    }

    const modelCandidates = getModelCandidates(options?.model);
    const timeoutMs = options?.timeoutMs ?? 30000;

    const formatted = toGeminiFormat(messages);

    if (formatted.contents.length === 0) {
        console.error("[slm] No content messages to send");
        return { ok: false, error: "No messages to send" };
    }

    const body = {
        ...formatted,
        generationConfig: {
            temperature: options?.temperature ?? 0.3,
            maxOutputTokens: 1024,
        },
    };

    let sawRateLimit = false;
    let lastError = "Max retries exceeded";

    for (const model of modelCandidates) {
        const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(timeoutMs),
                });

                if (res.status === 404) {
                    console.warn(`[slm] Model unavailable: ${model}`);
                    lastError = `Model unavailable: ${model}`;
                    break;
                }

                if (res.status === 429) {
                    sawRateLimit = true;
                    const text = await res.text().catch(() => "");
                    const quotaZero = /limit:\s*0/i.test(text);
                    if (quotaZero) {
                        console.warn(`[slm] ${model} has quota limit 0 for this key/project; trying fallback model`);
                        lastError = `Quota disabled for model: ${model}`;
                        break;
                    }

                    const retryAfter = res.headers.get("retry-after");
                    const waitMs = jitter(
                        retryAfter
                            ? parseInt(retryAfter, 10) * 1000
                            : RETRY_BASE_MS * Math.pow(2, attempt)
                    );

                    if (attempt < MAX_RETRIES) {
                        console.warn(`[slm] ${model} rate limited (429), retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                        await sleep(waitMs);
                        continue;
                    }

                    console.warn(`[slm] ${model} still rate limited after retries; trying fallback model`);
                    lastError = `Rate limited for model: ${model}`;
                    break;
                }

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    console.error(`[slm] ${model} returned ${res.status}:`, text.slice(0, 500));
                    lastError = `Gemini returned ${res.status}: ${text.slice(0, 200)}`;
                    break;
                }

                const data = (await res.json()) as {
                    candidates?: {
                        content?: { parts?: { text?: string }[] };
                    }[];
                    error?: { message?: string };
                };

                if (data.error) {
                    console.error(`[slm] ${model} API error:`, data.error.message);
                    lastError = data.error.message ?? "Gemini API error";
                    break;
                }

                const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

                if (!text) {
                    console.warn(`[slm] ${model} returned empty response`);
                    lastError = "Gemini returned an empty response";
                    break;
                }

                return { ok: true, message: text };
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                if (attempt < MAX_RETRIES && msg.includes("timeout")) {
                    console.warn(`[slm] ${model} timeout, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
                    continue;
                }
                console.error(`[slm] ${model} fetch error:`, msg);
                lastError = msg;
                break;
            }
        }
    }

    if (sawRateLimit) {
        return {
            ok: false,
            error: "Rate limited by Gemini API across available models.",
            rateLimited: true,
        };
    }

    return { ok: false, error: lastError };
}

/**
 * Convenience: send a single user message with a system prompt.
 */
export async function ask(
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; timeoutMs?: number }
): Promise<ChatResult> {
    return chat(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        options
    );
}

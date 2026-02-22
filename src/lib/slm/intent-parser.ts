/**
 * Intent Parser — converts natural language into structured intents via the SLM.
 *
 * The SLM only parses — all training decisions are made by the algorithm.
 */

import { ask } from "./client";
import { intentParsingPrompt } from "./prompts";

export type IntentType =
    | "volume_change"
    | "skip_workout"
    | "reschedule"
    | "modify_workout"
    | "report_health"
    | "ask_question"
    | "context_response"
    | "unknown";

export type ParsedIntent = {
    type: IntentType;
    params: Record<string, unknown>;
    confidence: number;
};

export type RunnerContext = {
    currentState: string;
    weeklyCapacityKm: number;
    currentVolumeKm: number;
    compliancePercent: number;
    activeInjuries: string[];
    goalDistance: string;
    goalDate: string;
};

const VALID_INTENTS: IntentType[] = [
    "volume_change",
    "skip_workout",
    "reschedule",
    "modify_workout",
    "report_health",
    "ask_question",
    "context_response",
    "unknown",
];

/**
 * Extract JSON from an LLM response that may contain markdown code fences or extra text.
 */
function extractJSON(text: string): string {
    // Try to find JSON in code fences first
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenced) return fenced[1].trim();

    // Try to find a JSON object directly
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return braceMatch[0];

    return text.trim();
}

/**
 * Parse user message into a structured intent.
 *
 * Strategy: keyword detection runs first (free, instant). SLM is only called
 * when keywords detect a likely actionable intent that needs parameter
 * extraction (e.g. "move my Thursday run to Saturday" needs date parsing).
 *
 * For conversational messages ("hi", "how am I doing?", etc.), keyword
 * detection returns "unknown" or "ask_question" and we skip the SLM
 * entirely — the conversational branch handles them with a single API call.
 * This keeps us to 1 Gemini call per message instead of 2.
 */
export async function parseIntent(
    userMessage: string,
    context: RunnerContext
): Promise<ParsedIntent> {
    const keywordResult = detectIntentFallback(userMessage);

    // Conversational messages — no SLM call needed, 0 API usage
    if (keywordResult.type === "unknown" || keywordResult.type === "ask_question") {
        console.log("[intent] Keyword result:", keywordResult.type, "(skipping SLM)");
        return keywordResult;
    }

    // Actionable intent detected by keywords — use SLM for precise parameter extraction
    console.log("[intent] Keyword match:", keywordResult.type, "— refining with SLM");
    const systemPrompt = intentParsingPrompt(context);
    const result = await ask(systemPrompt, userMessage, {
        temperature: 0.1,
        timeoutMs: 15000,
    });

    if (!result.ok || !result.message) {
        console.warn("[intent] SLM unavailable, using keyword params:", result.error);
        return keywordResult;
    }

    try {
        const jsonStr = extractJSON(result.message);
        const parsed = JSON.parse(jsonStr) as {
            type?: string;
            params?: Record<string, unknown>;
            confidence?: number;
        };

        const intentType = VALID_INTENTS.includes(parsed.type as IntentType)
            ? (parsed.type as IntentType)
            : keywordResult.type;

        return {
            type: intentType,
            params: parsed.params ?? keywordResult.params,
            confidence: typeof parsed.confidence === "number"
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.6,
        };
    } catch {
        return keywordResult;
    }
}

/**
 * Simple keyword-based fallback when SLM is unavailable or returns bad JSON.
 */
function detectIntentFallback(message: string): ParsedIntent {
    const lower = message.toLowerCase();

    if (
        /(?:too easy|very easy|make.*harder|harder plan|challenge me|push me|increase intensity)/i.test(lower)
    ) {
        return {
            type: "volume_change",
            params: { direction: "increase", amount: 0.12, reason: "too_easy_feedback" },
            confidence: 0.7,
        };
    }

    if (/(?:move|reschedule|shift).*(?:run|workout|session)/i.test(lower)) {
        return {
            type: "reschedule",
            params: { fromDate: "today", toDate: "tomorrow" },
            confidence: 0.65,
        };
    }

    if (/(?:change|modify|adjust|tweak).*(?:plan|schedule|workout|week)/i.test(lower)) {
        return {
            type: "modify_workout",
            params: { changes: "general_adjustment_request" },
            confidence: 0.62,
        };
    }

    if (/(?:more|increase|bump|add).*(?:run|volume|mileage|km|miles)/i.test(lower)) {
        return {
            type: "volume_change",
            params: { direction: "increase", amount: 0.1 },
            confidence: 0.6,
        };
    }
    if (/(?:less|reduce|decrease|cut).*(?:run|volume|mileage|km|miles)/i.test(lower)) {
        return {
            type: "volume_change",
            params: { direction: "decrease", amount: 0.1 },
            confidence: 0.6,
        };
    }
    if (/(?:skip|cancel|drop).*(?:run|workout|session|today|tomorrow)/i.test(lower)) {
        return {
            type: "skip_workout",
            params: { date: "today", reason: "user_request" },
            confidence: 0.65,
        };
    }
    if (/(?:hurt|pain|injury|sore|injured|ache)/i.test(lower)) {
        return {
            type: "report_health",
            params: { type: "pain", bodyPart: null, severity: 5 },
            confidence: 0.4,
        };
    }
    if (/(?:sick|ill|cold|flu|fever|tired|exhausted)/i.test(lower)) {
        return {
            type: "report_health",
            params: { type: "illness", bodyPart: null, severity: 5 },
            confidence: 0.4,
        };
    }
    if (/\?/.test(message)) {
        return {
            type: "ask_question",
            params: { topic: "general" },
            confidence: 0.3,
        };
    }

    return { type: "unknown", params: {}, confidence: 0 };
}

/**
 * Context Check-In — triggers when compliance drops and asks the runner why.
 *
 * Maps their response to adaptation actions that the algorithm can apply.
 */

import { ask } from "./client";
import { contextCheckInPrompt } from "./prompts";

export type CheckInTrigger = {
    shouldTrigger: boolean;
    compliancePercent: number;
    missedWorkouts: number;
    weeksLow: number;
};

export type AdaptationAction =
    | "grace_period"       // Busy → reduce plan temporarily
    | "recovery_mode"      // Sick → recovery state
    | "injury_watch"       // Sore → injury monitoring
    | "restructure"        // Burnout → probe phase, offer alternatives
    | "motivation_checkin" // Motivation → goal review
    | "plan_change"        // Preference → alternative templates
    | "none";

/**
 * Determine if a context check-in should be triggered.
 */
export function shouldTriggerCheckIn(
    compliancePercent: number,
    weeksLow: number
): CheckInTrigger {
    const threshold = 70;
    const minWeeks = 2;

    return {
        shouldTrigger: compliancePercent < threshold && weeksLow >= minWeeks,
        compliancePercent,
        missedWorkouts: Math.round((1 - compliancePercent / 100) * 5), // approx
        weeksLow,
    };
}

/**
 * Generate a check-in question via the SLM.
 * Falls back to a static message if SLM is offline.
 */
export async function generateCheckInQuestion(
    trigger: CheckInTrigger
): Promise<string> {
    const result = await ask(
        contextCheckInPrompt({
            compliancePercent: trigger.compliancePercent,
            missedWorkouts: trigger.missedWorkouts,
            weeksLow: trigger.weeksLow,
        }),
        "Generate a check-in message for this runner.",
        { temperature: 0.7 }
    );

    if (result.ok && result.message) {
        return result.message;
    }

    // Static fallback
    return `Hey! I noticed you've been missing some workouts lately (${trigger.compliancePercent}% compliance over the last ${trigger.weeksLow} weeks). No judgment — I just want to understand what's going on so we can adjust.\n\nWhat's been happening?\n• Life got busy\n• Not feeling well\n• Body hurting\n• Feeling burnt out\n• Lost motivation\n• Want to change the plan`;
}

/**
 * Map a user's context response to an adaptation action.
 */
export function mapResponseToAction(responseText: string): {
    action: AdaptationAction;
    description: string;
} {
    const lower = responseText.toLowerCase();

    if (/busy|work|schedule|time|family|travel/i.test(lower)) {
        return {
            action: "grace_period",
            description: "Got it — we'll reduce the plan for a couple weeks. No pressure.",
        };
    }
    if (/sick|ill|cold|flu|fever|not feeling well|unwell/i.test(lower)) {
        return {
            action: "recovery_mode",
            description: "Take care of yourself first. Switching to recovery mode until you're better.",
        };
    }
    if (/hurt|pain|sore|injury|ache|knee|shin|ankle|foot|hip|back/i.test(lower)) {
        return {
            action: "injury_watch",
            description: "Let's keep an eye on that. Switching to injury watch — lighter sessions until it feels better.",
        };
    }
    if (/burnout|burnt out|too much|overwhelmed|tired of/i.test(lower)) {
        return {
            action: "restructure",
            description: "Sounds like the plan needs a refresh. Let's try a different approach for a few weeks.",
        };
    }
    if (/motivation|don.t feel like|bored|no desire|why am i/i.test(lower)) {
        return {
            action: "motivation_checkin",
            description: "That's totally normal. Let's talk about your goals and see if we need to adjust.",
        };
    }
    if (/change|different|swap|prefer|rather|alternative/i.test(lower)) {
        return {
            action: "plan_change",
            description: "Let's shake things up. I can offer some alternative training structures.",
        };
    }

    return {
        action: "none",
        description: "Thanks for letting me know. We'll keep an eye on things.",
    };
}

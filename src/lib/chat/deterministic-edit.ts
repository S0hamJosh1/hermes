export type DeterministicEditIntentType =
    | "volume_change"
    | "plan_level_change"
    | "skip_workout"
    | "reschedule";

export type DeterministicEditAction =
    | "volume_change"
    | "skip_workout"
    | "reschedule"
    | "base_plan_level_change";

export type DeterministicEditMatch = {
    intentType: DeterministicEditIntentType;
    action: DeterministicEditAction;
    params: Record<string, unknown>;
    confidence: number;
    source: "deterministic";
};

const DATE_TOKEN_REGEX =
    /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun|today|tomorrow)\b/gi;

const DATE_NORMALIZE: Record<string, string> = {
    monday: "monday",
    mon: "monday",
    tuesday: "tuesday",
    tue: "tuesday",
    tues: "tuesday",
    wednesday: "wednesday",
    wed: "wednesday",
    thursday: "thursday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    friday: "friday",
    fri: "friday",
    saturday: "saturday",
    sat: "saturday",
    sunday: "sunday",
    sun: "sunday",
    today: "today",
    tomorrow: "tomorrow",
};

function uniqueDateMentions(text: string): string[] {
    const mentions: string[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = DATE_TOKEN_REGEX.exec(text)) !== null) {
        const raw = match[1]?.toLowerCase();
        if (!raw) continue;
        const normalized = DATE_NORMALIZE[raw] ?? raw;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        mentions.push(normalized);
    }
    return mentions;
}

function parseAmount(lower: string): number {
    const pct = /(\d{1,2})\s*%/.exec(lower);
    if (pct) {
        const n = Number(pct[1]);
        if (Number.isFinite(n) && n > 0) {
            return Math.max(0.02, Math.min(0.3, n / 100));
        }
    }
    return 0.1;
}

export function extractDeterministicEdit(message: string): DeterministicEditMatch | null {
    const lower = message.toLowerCase();
    const dateMentions = uniqueDateMentions(lower);

    const talksAboutWorkout = /(?:run|workout|session|plan|schedule|training)/i.test(lower);
    const asksSkip = /(?:skip|cancel|drop)\b/i.test(lower) && talksAboutWorkout;
    if (asksSkip) {
        return {
            intentType: "skip_workout",
            action: "skip_workout",
            params: { date: dateMentions[0] ?? "today" },
            confidence: 0.9,
            source: "deterministic",
        };
    }

    const asksReschedule =
        /(?:move|reschedule|shift|swap|postpone|rearrange|push\s+back|pull\s+forward)\b/i.test(lower) &&
        talksAboutWorkout;
    const hasScheduleConflict = /(?:busy|unavailable|conflict|double-booked|travel|trip|meeting|work)/i.test(lower);
    if (asksReschedule || (hasScheduleConflict && dateMentions.length > 0 && talksAboutWorkout)) {
        const fromMatch =
            /\b(?:from|on)\s+(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun|today|tomorrow)\b/i.exec(
                lower
            );
        const toMatch =
            /\bto\s+(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun|today|tomorrow)\b/i.exec(
                lower
            );
        const fromDate = fromMatch
            ? DATE_NORMALIZE[fromMatch[1].toLowerCase()] ?? fromMatch[1].toLowerCase()
            : dateMentions[0] ?? "today";
        const toDate = toMatch
            ? DATE_NORMALIZE[toMatch[1].toLowerCase()] ?? toMatch[1].toLowerCase()
            : dateMentions[1] ?? "tomorrow";

        return {
            intentType: "reschedule",
            action: "reschedule",
            params: { fromDate, toDate },
            confidence: 0.88,
            source: "deterministic",
        };
    }

    const requestsHarderPlan = /(?:harder|hard|more difficult|tougher|easier|easier plan|too easy|too hard|advanced|intermediate|novice|base plan|plan level|difficulty)/i.test(
        lower
    );
    const mentionsQuality = /(?:tempo|interval|workout|session|speed|quality)/i.test(lower);
    const hasWorkloadSignal = /(?:workload|training load|load|mileage|volume|km|miles)/i.test(lower);
    const increaseSignal = /(?:increase|more|bump|add|raise|up)\b/i.test(lower);
    const decreaseSignal = /(?:decrease|reduce|less|cut|lower)\b/i.test(lower);

    if (hasWorkloadSignal && (increaseSignal || decreaseSignal)) {
        return {
            intentType: "volume_change",
            action: "volume_change",
            params: {
                direction: decreaseSignal && !increaseSignal ? "decrease" : "increase",
                amount: parseAmount(lower),
            },
            confidence: 0.9,
            source: "deterministic",
        };
    }

    if (requestsHarderPlan) {
        return {
            intentType: "plan_level_change",
            action: "base_plan_level_change",
            params: {
                direction: /(?:easier|too hard|novice|downgrade|lower)/i.test(lower) ? "decrease" : "increase",
                changeType: mentionsQuality ? "workout_difficulty" : "unspecified",
            },
            confidence: 0.82,
            source: "deterministic",
        };
    }

    return null;
}

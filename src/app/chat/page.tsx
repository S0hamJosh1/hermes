"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PaperPlaneIcon } from "@radix-ui/react-icons";

type Message = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    intentType?: string | null;
    intentApplied?: boolean;
    createdAt: string;
};

type SlmStatus = {
    online: boolean;
    model: string;
    available: boolean;
};

type ChatReply = {
    reply: string;
    intent: { type: string; confidence: number; applied: boolean };
    checkIn?: string | null;
    messageId: string;
};

export default function ChatPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<SlmStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        try {
            const [histRes, statusRes] = await Promise.all([
                fetch("/api/chat?limit=100"),
                fetch("/api/chat/status"),
            ]);
            if (histRes.ok) {
                const data = (await histRes.json()) as { messages: Message[] };
                setMessages(data.messages);
            }
            if (statusRes.ok) {
                const data = (await statusRes.json()) as SlmStatus;
                setStatus(data);
            }
        } catch {
            // ignore
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function handleSend() {
        const text = input.trim();
        if (!text || sending) return;
        setInput("");
        setSending(true);

        const tempId = `temp-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: tempId, role: "user", content: text, createdAt: new Date().toISOString() },
        ]);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });
            if (res.ok) {
                const data = (await res.json()) as ChatReply;
                setMessages((prev) => [
                    ...prev,
                    {
                        id: data.messageId,
                        role: "assistant",
                        content: data.reply,
                        intentType: data.intent.type,
                        intentApplied: data.intent.applied,
                        createdAt: new Date().toISOString(),
                    },
                    ...(data.checkIn
                        ? [
                            {
                                id: `checkin-${Date.now()}`,
                                role: "system" as const,
                                content: data.checkIn,
                                createdAt: new Date().toISOString(),
                            },
                        ]
                        : []),
                ]);
            } else {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `err-${Date.now()}`,
                        role: "assistant",
                        content: "Something went wrong. Please try again.",
                        createdAt: new Date().toISOString(),
                    },
                ]);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    role: "assistant",
                    content: "Network error. Is the server running?",
                    createdAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setSending(false);
        }
    }

    const intentLabel: Record<string, string> = {
        volume_change: "Volume Change",
        plan_level_change: "Plan Level Change",
        skip_workout: "Skip Workout",
        reschedule: "Reschedule",
        modify_workout: "Modify Workout",
        report_health: "Health Report",
        ask_question: "Question",
        context_response: "Check-In Response",
    };

    const planEditIntentTypes = new Set([
        "volume_change",
        "plan_level_change",
        "skip_workout",
        "reschedule",
        "modify_workout",
    ]);

    const statusLabel =
        status?.online && status?.available
            ? "Gemini connected"
            : status?.online
                ? "API key issue"
                : "AI offline";

    const statusDotClass =
        status?.online && status?.available
            ? "bg-green-400"
            : status?.online
                ? "bg-amber-400"
                : "bg-red-400";

    if (loading) {
        return (
            <main className="flex h-[70vh] items-center justify-center text-white">
                <div className="animate-pulse text-sm text-white/40">Loading chat...</div>
            </main>
        );
    }

    return (
        <main className="flex h-full min-h-0 flex-col items-center px-2 py-2 text-white">
            <div className="flex h-full min-h-0 w-full max-w-6xl flex-col gap-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Hermes Chat</h1>
                        <p className="mt-0.5 text-xs uppercase tracking-widest text-white/40">
                            Training Assistant &amp; Plan Adjustments
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50">
                        <div className={`h-2 w-2 rounded-full ${statusDotClass}`} />
                        <span>{statusLabel}</span>
                    </div>
                </div>

                <div>
                    <p className="text-sm text-white/75">
                        Ask questions, report how you&apos;re feeling, or request changes to your plan without leaving the workspace.
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                        Hermes can answer training questions and apply supported plan edits directly from chat.
                    </p>
                </div>

                <div className="glass-card flex min-h-0 flex-1 flex-col p-4 sm:p-5">
                    <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-1 py-2">
                        {messages.length === 0 && (
                            <div className="flex h-full flex-col items-center justify-center gap-4 py-20 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/[0.04]">
                                    <PaperPlaneIcon className="h-7 w-7 text-white/70" />
                                </div>
                                <p className="max-w-2xl text-sm leading-8 text-white/58 sm:text-[15px]">
                                    Talk to Hermes, your running assistant. Ask questions, report how you&apos;re feeling,
                                    or request changes to your plan.
                                </p>
                                <div className="mt-1 flex flex-wrap justify-center gap-2">
                                    {[
                                        "How's my training going?",
                                        "I want to run more this week",
                                        "My knee hurts",
                                        "Skip today's workout",
                                    ].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => setInput(q)}
                                            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/52 transition hover:border-white/25 hover:text-white/75"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                        msg.role === "user"
                                            ? "rounded-br-md bg-white text-black"
                                            : msg.role === "system"
                                                ? "rounded-bl-md border border-amber-500/20 bg-amber-500/10 text-amber-200"
                                                : "rounded-bl-md border border-white/10 bg-white/5 text-white/80"
                                    }`}
                                >
                                    {msg.role === "system" && (
                                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-400/60">
                                            Check-In
                                        </p>
                                    )}
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    {msg.intentType &&
                                        msg.intentType !== "unknown" &&
                                        msg.intentType !== "ask_question" && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                                                    {intentLabel[msg.intentType] ?? msg.intentType}
                                                </span>
                                                {msg.intentApplied && (
                                                    <span className="text-[10px] text-green-400">Applied</span>
                                                )}
                                            </div>
                                        )}

                                    {msg.role === "assistant" &&
                                        msg.intentApplied &&
                                        msg.intentType &&
                                        planEditIntentTypes.has(msg.intentType) && (
                                            <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
                                                <p className="text-[11px] text-green-200">
                                                    Change applied to your plan.
                                                </p>
                                                <button
                                                    onClick={() => router.push("/plan")}
                                                    className="mt-2 rounded bg-white/10 px-2 py-1 text-[11px] text-white/80 transition hover:bg-white/20"
                                                >
                                                    View updated plan
                                                </button>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <div className="mt-4 shrink-0 border-t border-white/10 px-1 pt-4">
                        <div className="mx-auto flex max-w-4xl items-center gap-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                placeholder={
                                    status?.available
                                        ? "Tell Hermes what's on your mind..."
                                        : "AI offline - basic mode only"
                                }
                                disabled={sending}
                                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 transition focus:border-white/40 focus:outline-none disabled:opacity-50"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || sending}
                                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                                {sending ? (
                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                ) : (
                                    "Send"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

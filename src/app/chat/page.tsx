"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

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

    // Load status and history
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
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    async function handleSend() {
        const text = input.trim();
        if (!text || sending) return;
        setInput("");
        setSending(true);

        // Optimistically add user message
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
        volume_change: "📊 Volume Change",
        skip_workout: "⏭️ Skip Workout",
        reschedule: "📅 Reschedule",
        modify_workout: "✏️ Modify Workout",
        report_health: "🩺 Health Report",
        ask_question: "❓ Question",
        context_response: "💬 Check-In Response",
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40 text-sm">Loading chat...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="text-lg font-bold tracking-tight">Hermes Chat</div>
                    {/* SLM status indicator */}
                    <div className="flex items-center gap-1.5">
                        <div
                            className={`w-2 h-2 rounded-full ${status?.online && status?.available
                                ? "bg-green-400"
                                : status?.online
                                    ? "bg-amber-400"
                                    : "bg-red-400"
                                }`}
                        />
                        <span className="text-xs text-white/40">
                            {status?.online && status?.available
                                ? "Gemini connected"
                                : status?.online
                                    ? "API key issue"
                                    : "AI offline"}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => router.push("/dashboard")}
                    className="text-xs text-white/40 hover:text-white/70 transition"
                >
                    ← Dashboard
                </button>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-20">
                        <div className="text-4xl">🏃‍♂️</div>
                        <p className="text-white/60 text-sm max-w-sm">
                            Talk to Hermes — your running assistant. Ask questions, report
                            how you&apos;re feeling, or request changes to your plan.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                            {[
                                "How's my training going?",
                                "I want to run more this week",
                                "My knee hurts",
                                "Skip today's workout",
                            ].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => setInput(q)}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:border-white/30 hover:text-white/70 transition"
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
                            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                ? "bg-white text-black rounded-br-md"
                                : msg.role === "system"
                                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-bl-md"
                                    : "bg-white/5 border border-white/10 text-white/80 rounded-bl-md"
                                }`}
                        >
                            {msg.role === "system" && (
                                <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-1 font-medium">
                                    Check-In
                                </p>
                            )}
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.intentType &&
                                msg.intentType !== "unknown" &&
                                msg.intentType !== "ask_question" && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                                            {intentLabel[msg.intentType] ?? msg.intentType}
                                        </span>
                                        {msg.intentApplied && (
                                            <span className="text-[10px] text-green-400">
                                                ✓ Applied
                                            </span>
                                        )}
                                    </div>
                                )}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 px-6 py-4 shrink-0">
                <div className="flex items-center gap-3 max-w-3xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                        placeholder={
                            status?.available
                                ? "Tell Hermes what's on your mind..."
                                : "AI offline — basic mode only"
                        }
                        disabled={sending}
                        className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="px-5 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {sending ? (
                            <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            "Send"
                        )}
                    </button>
                </div>
            </div>
        </main>
    );
}

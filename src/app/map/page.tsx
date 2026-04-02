"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/map/MapView";

export default function MapPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        fetch("/api/auth/me")
            .then((response) => {
                if (!response.ok) {
                    router.push("/");
                    return;
                }
                if (!cancelled) {
                    setLoading(false);
                }
            })
            .catch(() => {
                router.push("/");
            });

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (loading) {
        return (
            <main className="h-[70vh] text-white flex items-center justify-center">
                <div className="animate-pulse text-white/40">Loading map view...</div>
            </main>
        );
    }

    return (
        <main className="text-white flex flex-col items-center px-2 py-2">
            <div className="w-full max-w-6xl flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Map</h1>
                        <p className="text-xs text-white/40 uppercase tracking-widest mt-0.5">
                            Strava Route Overlay
                        </p>
                    </div>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="text-xs text-white/40 hover:text-white/70 transition"
                    >
                        ← Dashboard
                    </button>
                </div>

                <div className="glass-card p-5">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm text-white/75">
                                Recent Strava routes, layered on a dark map so you can see your training footprint at a glance.
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                                Hermes loads the latest 50 routes first and can pull in more on demand.
                            </p>
                        </div>
                    </div>

                    <MapView />
                </div>
            </div>
        </main>
    );
}

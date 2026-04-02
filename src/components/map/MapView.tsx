"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeNoneIcon, EyeOpenIcon, GlobeIcon, ReloadIcon } from "@radix-ui/react-icons";
import type { Feature, LineString } from "geojson";
import type { GeoJSONSource, Map as MapboxMap, Popup } from "mapbox-gl";
import { decodePolylineToFeature, toFeatureCollection, type RouteFeatureProperties } from "@/lib/map/decodePolyline";
import { formatMiles } from "@/lib/units";

type MapActivityResponse = {
    id: number;
    name: string;
    distance: number;
    summaryPolyline: string | null;
};

type MapApiResponse = {
    activities: MapActivityResponse[];
    pagination: {
        page: number;
        limit: number;
        returned: number;
        hasMore: boolean;
    };
    error?: string;
};

type RouteRecord = {
    id: number;
    name: string;
    distance: number;
    summaryPolyline: string | null;
    feature: Feature<LineString, RouteFeatureProperties>;
};

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const ROUTES_SOURCE_ID = "hermes-map-routes";
const ROUTES_LAYER_ID = "hermes-map-routes-line";
const SELECTED_SOURCE_ID = "hermes-map-selected-route";
const SELECTED_LAYER_ID = "hermes-map-selected-line";

function formatDistance(distanceMeters: number): string {
    return formatMiles(distanceMeters / 1000, 1);
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function buildPopupHtml(route: RouteRecord): string {
    return `
      <div class="px-4 py-3">
        <p class="text-[10px] uppercase tracking-[0.18em] text-white/40">Strava Activity</p>
        <p class="mt-1 text-sm font-semibold text-white">${escapeHtml(route.name)}</p>
        <p class="mt-1 text-xs text-white/60">${escapeHtml(formatDistance(route.distance))}</p>
      </div>
    `;
}

function getBounds(features: Feature<LineString, RouteFeatureProperties>[]) {
    if (features.length === 0) return null;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    for (const feature of features) {
        for (const [lng, lat] of feature.geometry.coordinates) {
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
        }
    }

    return [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]];
}

function ensureRouteLayers(map: MapboxMap) {
    if (!map.getSource(ROUTES_SOURCE_ID)) {
        map.addSource(ROUTES_SOURCE_ID, {
            type: "geojson",
            data: toFeatureCollection([]),
        });

        map.addLayer({
            id: ROUTES_LAYER_ID,
            type: "line",
            source: ROUTES_SOURCE_ID,
            layout: {
                "line-cap": "round",
                "line-join": "round",
            },
            paint: {
                "line-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "distanceMeters"],
                    0,
                    "rgba(110, 231, 183, 0.40)",
                    10000,
                    "rgba(163, 230, 53, 0.55)",
                    25000,
                    "rgba(103, 232, 249, 0.72)",
                    42000,
                    "rgba(125, 211, 252, 0.88)",
                ],
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    2,
                    12,
                    3.5,
                    15,
                    5,
                ],
                "line-opacity": 0.62,
            },
        });
    }

    if (!map.getSource(SELECTED_SOURCE_ID)) {
        map.addSource(SELECTED_SOURCE_ID, {
            type: "geojson",
            data: toFeatureCollection([]),
        });

        map.addLayer({
            id: SELECTED_LAYER_ID,
            type: "line",
            source: SELECTED_SOURCE_ID,
            layout: {
                "line-cap": "round",
                "line-join": "round",
            },
            paint: {
                "line-color": "rgba(255,255,255,0.95)",
                "line-width": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    3,
                    12,
                    5,
                    15,
                    7,
                ],
                "line-opacity": 0.98,
            },
        });
    }
}

function getRouteId(properties: unknown): number | null {
    if (!properties || typeof properties !== "object" || !("id" in properties)) {
        return null;
    }

    const value = (properties as { id?: string | number }).id;
    const routeId = typeof value === "string" ? Number(value) : value;
    return typeof routeId === "number" && Number.isFinite(routeId) ? routeId : null;
}

export default function MapView() {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapboxMap | null>(null);
    const popupRef = useRef<Popup | null>(null);
    const routesRef = useRef<RouteRecord[]>([]);
    const hasFittedBoundsRef = useRef(false);
    const [routes, setRoutes] = useState<RouteRecord[]>([]);
    const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
    const [hoveredRouteId, setHoveredRouteId] = useState<number | null>(null);
    const [hiddenRouteIds, setHiddenRouteIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const visibleRoutes = useMemo(
        () => routes.filter((route) => !hiddenRouteIds.has(route.id)),
        [routes, hiddenRouteIds],
    );
    const selectedRoute = useMemo(
        () => visibleRoutes.find((route) => route.id === selectedRouteId) ?? null,
        [selectedRouteId, visibleRoutes],
    );
    const hoveredRoute = useMemo(
        () => visibleRoutes.find((route) => route.id === hoveredRouteId) ?? null,
        [hoveredRouteId, visibleRoutes],
    );
    const headlineRoute = hoveredRoute ?? selectedRoute;

    useEffect(() => {
        routesRef.current = routes;
    }, [routes]);

    useEffect(() => {
        if (selectedRouteId !== null && !visibleRoutes.some((route) => route.id === selectedRouteId)) {
            setSelectedRouteId(null);
            popupRef.current?.remove();
        }
    }, [selectedRouteId, visibleRoutes]);

    useEffect(() => {
        if (!mapboxToken || !mapContainerRef.current || mapRef.current) {
            return;
        }

        let disposed = false;

        void (async () => {
            const mapboxglModule = await import("mapbox-gl");
            const mapboxgl = mapboxglModule.default;

            if (disposed || !mapContainerRef.current) return;

            mapboxgl.accessToken = mapboxToken;

            const firstCoord = routesRef.current[0]?.feature.geometry.coordinates[0] as [number, number] | undefined;
            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: "mapbox://styles/mapbox/dark-v11",
                center: firstCoord ?? DEFAULT_CENTER,
                zoom: firstCoord ? 10.5 : 3.4,
                attributionControl: false,
            });

            map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
            mapRef.current = map;

            map.on("load", () => {
                ensureRouteLayers(map);
            });

            map.on("mouseenter", ROUTES_LAYER_ID, () => {
                map.getCanvas().style.cursor = "pointer";
            });

            map.on("mouseleave", ROUTES_LAYER_ID, () => {
                map.getCanvas().style.cursor = "";
                setHoveredRouteId(null);
            });

            map.on("mousemove", ROUTES_LAYER_ID, (event) => {
                const routeId = getRouteId(event.features?.[0]?.properties);
                setHoveredRouteId(routeId);
            });

            map.on("click", ROUTES_LAYER_ID, (event) => {
                const routeId = getRouteId(event.features?.[0]?.properties);
                if (routeId === null) return;

                const route = routesRef.current.find((item) => item.id === routeId);
                if (!route) return;

                setSelectedRouteId(routeId);
                popupRef.current?.remove();
                popupRef.current = new mapboxgl.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    offset: 14,
                })
                    .setLngLat(event.lngLat)
                    .setHTML(buildPopupHtml(route))
                    .addTo(map);
            });
        })();

        return () => {
            disposed = true;
            popupRef.current?.remove();
            popupRef.current = null;
            mapRef.current?.remove();
            mapRef.current = null;
            hasFittedBoundsRef.current = false;
        };
    }, [mapboxToken]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const updateMapData = () => {
            ensureRouteLayers(map);

            const routeSource = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource | undefined;
            const selectedSource = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;

            routeSource?.setData(toFeatureCollection(visibleRoutes.map((route) => route.feature)));
            selectedSource?.setData(
                toFeatureCollection(selectedRoute ? [selectedRoute.feature] : []),
            );

            if (!hasFittedBoundsRef.current && visibleRoutes.length > 0) {
                const bounds = getBounds(visibleRoutes.map((route) => route.feature));
                if (bounds) {
                    map.fitBounds(bounds, {
                        padding: { top: 60, right: 60, bottom: 60, left: 60 },
                        duration: 0,
                    });
                }
                hasFittedBoundsRef.current = true;
            }
        };

        if (map.isStyleLoaded()) {
            updateMapData();
        } else {
            map.once("load", updateMapData);
        }
    }, [selectedRoute, visibleRoutes]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selectedRoute) return;

        const bounds = getBounds([selectedRoute.feature]);
        if (!bounds) return;

        map.fitBounds(bounds, {
            padding: { top: 80, right: 80, bottom: 80, left: 80 },
            duration: 700,
        });
    }, [selectedRouteId, selectedRoute]);

    async function loadPage(targetPage: number, mode: "replace" | "append") {
        if (mode === "replace") {
            setLoading(true);
            setError(null);
            hasFittedBoundsRef.current = false;
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await fetch(`/api/map/activities?page=${targetPage}&limit=50`);
            const data = (await res.json()) as MapApiResponse;

            if (!res.ok) {
                throw new Error(data.error ?? "Unable to load map activities.");
            }

            const decodedRoutes = data.activities
                .map((activity) => {
                    const feature = decodePolylineToFeature(activity);
                    if (!feature) return null;

                    return {
                        ...activity,
                        feature,
                    };
                })
                .filter(Boolean) as RouteRecord[];

            setRoutes((current) => {
                const merged = mode === "append" ? [...current, ...decodedRoutes] : decodedRoutes;
                const deduped = new Map<number, RouteRecord>();
                for (const route of merged) {
                    deduped.set(route.id, route);
                }
                return Array.from(deduped.values());
            });
            setHasMore(data.pagination.hasMore);
            setPage(targetPage);
            if (mode === "replace") {
                setHiddenRouteIds(new Set());
                setSelectedRouteId(null);
                setHoveredRouteId(null);
            }
        } catch (loadError) {
            const message = loadError instanceof Error ? loadError.message : "Unable to load map activities.";
            setError(message);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        void loadPage(1, "replace");
    }, []);

    function toggleRouteVisibility(routeId: number) {
        setHiddenRouteIds((current) => {
            const next = new Set(current);
            if (next.has(routeId)) {
                next.delete(routeId);
            } else {
                next.add(routeId);
            }
            return next;
        });
    }

    function showAllRoutes() {
        setHiddenRouteIds(new Set());
    }

    function hideAllRoutes() {
        setHiddenRouteIds(new Set(routes.map((route) => route.id)));
        setSelectedRouteId(null);
        popupRef.current?.remove();
    }

    function selectRoute(routeId: number) {
        if (hiddenRouteIds.has(routeId)) {
            toggleRouteVisibility(routeId);
        }
        setSelectedRouteId(routeId);
    }

    if (!mapboxToken) {
        return (
            <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-white/[0.02] px-5 py-6">
                <p className="text-sm text-red-300">Map View needs `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` before it can render.</p>
                <p className="mt-2 text-xs text-white/45">
                    Add the token to your local env file and your Vercel environment, then redeploy.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-[1.35rem] border border-white/8 bg-black/20">
                <div className="relative">
                    <div ref={mapContainerRef} className="h-[600px] w-full" />

                    {headlineRoute ? (
                        <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/12 bg-[#090d13]/85 px-4 py-3 backdrop-blur-xl">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Focused route</p>
                            <p className="mt-1 text-sm font-semibold text-white">{headlineRoute.name}</p>
                            <p className="text-xs text-white/60">{formatDistance(headlineRoute.distance)}</p>
                        </div>
                    ) : null}

                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/55 backdrop-blur-sm">
                            <div className="text-sm text-white/55">Loading recent Strava routes...</div>
                        </div>
                    ) : null}

                    {!loading && !error && visibleRoutes.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/55 backdrop-blur-sm">
                            <div className="max-w-sm text-center">
                                <p className="text-sm text-white/75">No mappable routes found yet.</p>
                                <p className="mt-2 text-xs text-white/45">
                                    Hermes skips activities that do not include a Strava summary polyline.
                                </p>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <div className="glass-card p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs text-blue-200/40 uppercase tracking-widest">Route Controls</p>
                        <p className="mt-1 text-sm text-white/60">
                            {visibleRoutes.length} of {routes.length} loaded routes currently visible
                        </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.03]">
                        <GlobeIcon className="h-4 w-4 text-white/65" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={showAllRoutes}
                        className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                    >
                        Show all
                    </button>
                    <button
                        onClick={hideAllRoutes}
                        className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                    >
                        Hide all
                    </button>
                </div>

                {error ? (
                    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                ) : null}

                <div className="max-h-[430px] overflow-y-auto pr-1">
                    <div className="flex flex-col gap-2">
                        {routes.map((route) => {
                            const hidden = hiddenRouteIds.has(route.id);
                            const selected = route.id === selectedRouteId;
                            return (
                                <div
                                    key={route.id}
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${selected
                                        ? "border-cyan-300/30 bg-cyan-300/10"
                                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={() => selectRoute(route.id)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <p className="truncate text-sm font-medium text-white">{route.name}</p>
                                            <p className="mt-1 text-xs text-white/45">{formatDistance(route.distance)}</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleRouteVisibility(route.id);
                                            }}
                                            title={hidden ? "Show route" : "Hide route"}
                                            className="rounded-xl border border-white/12 bg-white/[0.03] p-2 text-white/65 transition hover:bg-white/[0.06] hover:text-white"
                                        >
                                            {hidden ? <EyeNoneIcon className="h-4 w-4" /> : <EyeOpenIcon className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button
                    onClick={() => void loadPage(page + 1, "append")}
                    disabled={!hasMore || loadingMore}
                    className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <ReloadIcon className={`h-4 w-4 ${loadingMore ? "animate-spin" : ""}`} />
                    {loadingMore ? "Loading more..." : hasMore ? "Load 50 more routes" : "No more recent routes"}
                </button>
            </div>
        </div>
    );
}

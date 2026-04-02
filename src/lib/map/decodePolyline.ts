import polyline from "@mapbox/polyline";
import type { Feature, FeatureCollection, LineString } from "geojson";

export type RouteFeatureProperties = {
    id: number;
    name: string;
    distanceMeters: number;
};

type PolylineActivityInput = {
    id: number;
    name: string;
    distance: number;
    summaryPolyline: string | null;
};

export function decodePolyline(summaryPolyline: string): [number, number][] {
    return polyline.decode(summaryPolyline).map(([lat, lng]) => [lng, lat] as [number, number]);
}

export function decodePolylineToFeature(
    activity: PolylineActivityInput,
): Feature<LineString, RouteFeatureProperties> | null {
    if (!activity.summaryPolyline) return null;

    const coordinates = decodePolyline(activity.summaryPolyline);
    if (coordinates.length < 2) return null;

    return {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates,
        },
        properties: {
            id: activity.id,
            name: activity.name,
            distanceMeters: activity.distance,
        },
    };
}

export function toFeatureCollection(
    features: Feature<LineString, RouteFeatureProperties>[],
): FeatureCollection<LineString, RouteFeatureProperties> {
    return {
        type: "FeatureCollection",
        features,
    };
}

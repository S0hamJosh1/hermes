declare module "@mapbox/polyline" {
  const polyline: {
    decode(encoded: string, precision?: number): [number, number][];
    encode(coordinates: [number, number][], precision?: number): string;
    fromGeoJSON(geojson: unknown, precision?: number): string;
    toGeoJSON(encoded: string, precision?: number): unknown;
  };

  export default polyline;
}

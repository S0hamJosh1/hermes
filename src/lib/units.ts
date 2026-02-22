const KM_TO_MILES = 0.621371;
const MILE_IN_KM = 1.609344;

export function kmToMiles(km: number): number {
    return km * KM_TO_MILES;
}

export function formatMiles(km: number, digits = 1): string {
    return `${kmToMiles(km).toFixed(digits)} mi`;
}

export function pacePerMileFromPerKm(secondsPerKm: number): number {
    return secondsPerKm * MILE_IN_KM;
}

export function formatPacePerMile(secondsPerKm: number): string {
    const totalSeconds = pacePerMileFromPerKm(secondsPerKm);
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.round(totalSeconds % 60);
    const safeMins = secs === 60 ? mins + 1 : mins;
    const safeSecs = secs === 60 ? 0 : secs;
    return `${safeMins}:${String(safeSecs).padStart(2, "0")} /mi`;
}

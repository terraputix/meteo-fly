import type { PressureLevel } from '$lib/meteo/types';

export const pressureLevels: PressureLevel[] = [
    { hPa: 1000, heightMeters: 110 },
    { hPa: 975, heightMeters: 320 },
    { hPa: 950, heightMeters: 540 },
    { hPa: 925, heightMeters: 770 },
    { hPa: 900, heightMeters: 1000 },
    { hPa: 850, heightMeters: 1500 },
    { hPa: 800, heightMeters: 2000 },
    { hPa: 700, heightMeters: 3000 },
    { hPa: 600, heightMeters: 4200 },
];

export const interpolatedLevels: PressureLevel[] = [
    { hPa: -1, heightMeters: 1250 },
    { hPa: -1, heightMeters: 1750 },
    { hPa: -1, heightMeters: 2250 },
    { hPa: -1, heightMeters: 2500 },
    { hPa: -1, heightMeters: 2750 },
    { hPa: -1, heightMeters: 3250 },
    { hPa: -1, heightMeters: 3500 },
    { hPa: -1, heightMeters: 3750 },
    { hPa: -1, heightMeters: 4000 },
];

export const allLevels: PressureLevel[] = [
    ...pressureLevels,
    ...interpolatedLevels
].sort((a, b) => a.heightMeters - b.heightMeters);

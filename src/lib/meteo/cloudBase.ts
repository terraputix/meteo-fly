import type { WeatherDataType } from "$lib/api/api";

/**
 * Calculates the Lifting Condensation Level (cloud base) height using Espy's equation
 * @param temperature Temperature in degrees Celsius
 * @param dewpoint Dewpoint temperature in degrees Celsius
 * @returns Height of cloud base in meters
 */
function calculateCloudBase(temperature: number, dewpoint: number): number {
    // Input validation
    if (isNaN(temperature) || isNaN(dewpoint)) {
        throw new Error('Temperature and dewpoint must be valid numbers');
    }

    if (dewpoint > temperature) {
        console.log('Dewpoint cannot be higher than temperature');
        console.log('Dewpoint:', dewpoint);
        console.log('Temperature:', temperature);
        return 0;
    }

    // Espy's equation: LCL ≈ 125 * (T - Td) meters
    const cloudBaseHeight = 125 * (temperature - dewpoint);

    return Math.round(cloudBaseHeight);
}

export function calculateCloudBaseWeather(data: WeatherDataType): { x: Date, y: number }[] {

    const cloudBases: { x: Date, y: number }[] = [];

    const times = data.hourly.time;
    const temperatures = data.hourly.temperature_2m;
    const dewpoints = data.hourly.dewpoint_2m;

    for (let i = 0; i < times.length; i++) {
        const temperature = temperatures[i];
        const dewpoint = dewpoints[i];

        const cloudBase = calculateCloudBase(temperature, dewpoint);
        cloudBases.push({ x: times[i], y: cloudBase + data.elevation });
    }

    return cloudBases;
}

import type { CloudCoverKey, WeatherDataType } from '$lib/api';
import { pressureLevels } from './pressureLevels';

function getCloudCover(data: WeatherDataType, pressure: number): Float32Array {
    return data.hourly[`cloudCover${pressure}hPa` as CloudCoverKey];
}

export function getCloudCoverData(weatherData: WeatherDataType) {
    const data: { x1: Date; x2: Date; y1: number; y2: number; value: number; }[] = [];
    const levels = pressureLevels;
    const times = weatherData.hourly.time;

    const cloudCoverData = levels.map(level =>
        getCloudCover(weatherData, level.hPa)
    );

    times.forEach((time, i) => {
        const nextTime = times[i + 1] || new Date(time.getTime() + 3600000); // Next time or +1 hour

        levels.forEach((level, j) => {
            const cloudCoverArray = cloudCoverData[j];
            const cloudCover = cloudCoverArray[i];
            const nextLevel = levels[j + 1];
            const y1 = level.heightMeters;
            const y2 = nextLevel ? nextLevel.heightMeters : level.heightMeters + 500; // Estimate next level

            data.push({
                x1: time,
                x2: nextTime,
                y1: y1,
                y2: y2,
                value: cloudCover,
            });
        });
    });
    return data;
}

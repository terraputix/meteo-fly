import type { CloudCoverKey, WeatherDataType } from '$lib/api';
import type { PointOptionsObject } from 'highcharts';
import { pressureLevels } from './pressureLevels';

export function getCloudCoverData(weatherData: WeatherDataType): Array<PointOptionsObject> {
    const data: PointOptionsObject[] = [];
    const levels = pressureLevels;

    weatherData.hourly.time.forEach((time, i) => {
        levels.forEach((level) => {
            const cloudCover = weatherData.hourly[`cloudCover${level.hPa}hPa` as CloudCoverKey][i];
            data.push({
                x: time.getTime(),
                y: level.heightMeters,
                value: cloudCover
            });
        });
    });

    console.log(data);
    return data;
}

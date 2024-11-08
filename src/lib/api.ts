import { fetchWeatherApi } from 'openmeteo';

export interface Location {
    latitude: number;
    longitude: number;
}

export type WeatherModel = 'icon_d2' | 'icon_seamless' | 'icon_eu' | 'icon_global' | 'meteofrance_seamless' | 'gfs_seamless' | 'ukmo_seamless' | 'cma_grapes_global' | 'gem_seamless';

export interface HourlyData {
    time: Date[];
    precipitation: Float32Array;
    temperature_2m: Float32Array;
    dewpoint_2m: Float32Array;
    cloudCover: Float32Array;
    cloudCoverLow: Float32Array;
    cloudCoverMid: Float32Array;
    cloudCoverHigh: Float32Array;
    windSpeed10m: Float32Array;
    windSpeed80m: Float32Array;
    windSpeed120m: Float32Array;
    windSpeed180m: Float32Array;
    windDirection10m: Float32Array;
    windDirection80m: Float32Array;
    windDirection120m: Float32Array;
    windDirection180m: Float32Array;
    cloudCover1000hPa: Float32Array;
    cloudCover975hPa: Float32Array;
    cloudCover950hPa: Float32Array;
    cloudCover925hPa: Float32Array;
    cloudCover900hPa: Float32Array;
    cloudCover850hPa: Float32Array;
    cloudCover800hPa: Float32Array;
    cloudCover700hPa: Float32Array;
    cloudCover600hPa: Float32Array;
    cloudCover500hPa: Float32Array;
    cloudCover400hPa: Float32Array;
    cloudCover300hPa: Float32Array;
    cloudCover250hPa: Float32Array;
    cloudCover200hPa: Float32Array;
    cloudCover150hPa: Float32Array;
    cloudCover100hPa: Float32Array;
    cloudCover70hPa: Float32Array;
    cloudCover50hPa: Float32Array;
    cloudCover30hPa: Float32Array;
    windSpeed1000hPa: Float32Array;
    windSpeed975hPa: Float32Array;
    windSpeed950hPa: Float32Array;
    windSpeed925hPa: Float32Array;
    windSpeed900hPa: Float32Array;
    windSpeed850hPa: Float32Array;
    windSpeed800hPa: Float32Array;
    windSpeed700hPa: Float32Array;
    windSpeed600hPa: Float32Array;
    windDirection1000hPa: Float32Array;
    windDirection975hPa: Float32Array;
    windDirection950hPa: Float32Array;
    windDirection925hPa: Float32Array;
    windDirection900hPa: Float32Array;
    windDirection850hPa: Float32Array;
    windDirection800hPa: Float32Array;
    windDirection700hPa: Float32Array;
    windDirection600hPa: Float32Array;
}

export type HourlyKeys = keyof HourlyData;
export type WindSpeedKey = Extract<HourlyKeys, `windSpeed${number}hPa`>;
export type WindDirectionKey = Extract<HourlyKeys, `windDirection${number}hPa`>;
export type CloudCoverKey = Extract<HourlyKeys, `cloudCover${number}hPa`>;

export interface WeatherDataType {
    hourly: HourlyData;
    elevation: number;
}

const paramsTemplate = {
    "hourly": ["precipitation", "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "wind_speed_10m", "wind_speed_80m", "wind_speed_120m", "wind_speed_180m", "wind_direction_10m", "wind_direction_80m", "wind_direction_120m", "wind_direction_180m", "cloud_cover_1000hPa", "cloud_cover_975hPa", "cloud_cover_950hPa", "cloud_cover_925hPa", "cloud_cover_900hPa", "cloud_cover_850hPa", "cloud_cover_800hPa", "cloud_cover_700hPa", "cloud_cover_600hPa", "cloud_cover_500hPa", "cloud_cover_400hPa", "cloud_cover_300hPa", "cloud_cover_250hPa", "cloud_cover_200hPa", "cloud_cover_150hPa", "cloud_cover_100hPa", "cloud_cover_70hPa", "cloud_cover_50hPa", "cloud_cover_30hPa", "wind_speed_1000hPa", "wind_speed_975hPa", "wind_speed_950hPa", "wind_speed_925hPa", "wind_speed_900hPa", "wind_speed_850hPa", "wind_speed_800hPa", "wind_speed_700hPa", "wind_speed_600hPa", "wind_direction_1000hPa", "wind_direction_975hPa", "wind_direction_950hPa", "wind_direction_925hPa", "wind_direction_900hPa", "wind_direction_850hPa", "wind_direction_800hPa", "wind_direction_700hPa", "wind_direction_600hPa", "temperature_2m", "dew_point_2m"]
};
const url = "https://api.open-meteo.com/v1/forecast";

// Helper function to form time ranges
const range = (start: number, stop: number, step: number) =>
    Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

export async function fetchWeatherData(location: Location, model: WeatherModel = "icon_d2", start: Date, numberOfDays: number = 1): Promise<WeatherDataType> {

    // Format the start_date as 'YYYY-MM-DD'
    const startDateStr = start.toISOString().split('T')[0];

    // Calculate the end_date based on number_of_days
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + numberOfDays - 1);
    const endDateStr = endDate.toISOString().split('T')[0];

    const params = { ...paramsTemplate, latitude: location.latitude, longitude: location.longitude, start_date: startDateStr, end_date: endDateStr, models: model };
    const responses = await fetchWeatherApi(url, params);
    // Process first location. Add a for-loop for multiple locations or weather models
    const response = responses[0];

    // Attributes for timezone and location
    const utcOffsetSeconds = response.utcOffsetSeconds();
    // const timezone = response.timezone();
    // const timezoneAbbreviation = response.timezoneAbbreviation();
    // const latitude = response.latitude();
    // const longitude = response.longitude();
    const elevation = response.elevation();

    const hourly = response.hourly()!;
    const weatherData = {
        elevation: elevation,
        hourly: {
            time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
                (t) => new Date((t + utcOffsetSeconds) * 1000)
            ),
            precipitation: hourly.variables(0)!.valuesArray()!,
            temperature_2m: hourly.variables(50)!.valuesArray()!,
            dewpoint_2m: hourly.variables(51)!.valuesArray()!,
            cloudCover: hourly.variables(1)!.valuesArray()!,
            cloudCoverLow: hourly.variables(2)!.valuesArray()!,
            cloudCoverMid: hourly.variables(3)!.valuesArray()!,
            cloudCoverHigh: hourly.variables(4)!.valuesArray()!,
            windSpeed10m: hourly.variables(5)!.valuesArray()!,
            windSpeed80m: hourly.variables(6)!.valuesArray()!,
            windSpeed120m: hourly.variables(7)!.valuesArray()!,
            windSpeed180m: hourly.variables(8)!.valuesArray()!,
            windDirection10m: hourly.variables(9)!.valuesArray()!,
            windDirection80m: hourly.variables(10)!.valuesArray()!,
            windDirection120m: hourly.variables(11)!.valuesArray()!,
            windDirection180m: hourly.variables(12)!.valuesArray()!,
            cloudCover1000hPa: hourly.variables(13)!.valuesArray()!,
            cloudCover975hPa: hourly.variables(14)!.valuesArray()!,
            cloudCover950hPa: hourly.variables(15)!.valuesArray()!,
            cloudCover925hPa: hourly.variables(16)!.valuesArray()!,
            cloudCover900hPa: hourly.variables(17)!.valuesArray()!,
            cloudCover850hPa: hourly.variables(18)!.valuesArray()!,
            cloudCover800hPa: hourly.variables(19)!.valuesArray()!,
            cloudCover700hPa: hourly.variables(20)!.valuesArray()!,
            cloudCover600hPa: hourly.variables(21)!.valuesArray()!,
            cloudCover500hPa: hourly.variables(22)!.valuesArray()!,
            cloudCover400hPa: hourly.variables(23)!.valuesArray()!,
            cloudCover300hPa: hourly.variables(24)!.valuesArray()!,
            cloudCover250hPa: hourly.variables(25)!.valuesArray()!,
            cloudCover200hPa: hourly.variables(26)!.valuesArray()!,
            cloudCover150hPa: hourly.variables(27)!.valuesArray()!,
            cloudCover100hPa: hourly.variables(28)!.valuesArray()!,
            cloudCover70hPa: hourly.variables(29)!.valuesArray()!,
            cloudCover50hPa: hourly.variables(30)!.valuesArray()!,
            cloudCover30hPa: hourly.variables(31)!.valuesArray()!,
            windSpeed1000hPa: hourly.variables(32)!.valuesArray()!,
            windSpeed975hPa: hourly.variables(33)!.valuesArray()!,
            windSpeed950hPa: hourly.variables(34)!.valuesArray()!,
            windSpeed925hPa: hourly.variables(35)!.valuesArray()!,
            windSpeed900hPa: hourly.variables(36)!.valuesArray()!,
            windSpeed850hPa: hourly.variables(37)!.valuesArray()!,
            windSpeed800hPa: hourly.variables(38)!.valuesArray()!,
            windSpeed700hPa: hourly.variables(39)!.valuesArray()!,
            windSpeed600hPa: hourly.variables(40)!.valuesArray()!,
            windDirection1000hPa: hourly.variables(41)!.valuesArray()!,
            windDirection975hPa: hourly.variables(42)!.valuesArray()!,
            windDirection950hPa: hourly.variables(43)!.valuesArray()!,
            windDirection925hPa: hourly.variables(44)!.valuesArray()!,
            windDirection900hPa: hourly.variables(45)!.valuesArray()!,
            windDirection850hPa: hourly.variables(46)!.valuesArray()!,
            windDirection800hPa: hourly.variables(47)!.valuesArray()!,
            windDirection700hPa: hourly.variables(48)!.valuesArray()!,
            windDirection600hPa: hourly.variables(49)!.valuesArray()!,
        },

    };

    return weatherData;
}

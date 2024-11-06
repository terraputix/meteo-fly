import { fetchWeatherApi } from 'openmeteo';

const params = {
    "latitude": 52.52,
    "longitude": 13.41,
    "hourly": ["precipitation", "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "wind_speed_10m", "wind_speed_80m", "wind_speed_120m", "wind_speed_180m", "wind_direction_10m", "wind_direction_80m", "wind_direction_120m", "wind_direction_180m", "cloud_cover_1000hPa", "cloud_cover_975hPa", "cloud_cover_950hPa", "cloud_cover_925hPa", "cloud_cover_900hPa", "cloud_cover_850hPa", "cloud_cover_800hPa", "cloud_cover_700hPa", "cloud_cover_600hPa", "cloud_cover_500hPa", "cloud_cover_400hPa", "cloud_cover_300hPa", "cloud_cover_250hPa", "cloud_cover_200hPa", "cloud_cover_150hPa", "cloud_cover_100hPa", "cloud_cover_70hPa", "cloud_cover_50hPa", "cloud_cover_30hPa", "wind_speed_1000hPa", "wind_speed_975hPa", "wind_speed_950hPa", "wind_speed_925hPa", "wind_speed_900hPa", "wind_speed_850hPa", "wind_speed_800hPa", "wind_speed_700hPa", "wind_speed_600hPa", "wind_direction_1000hPa", "wind_direction_975hPa", "wind_direction_950hPa", "wind_direction_925hPa", "wind_direction_900hPa", "wind_direction_850hPa", "wind_direction_800hPa", "wind_direction_700hPa", "wind_direction_600hPa"],
    "forecast_days": 1,
    "models": "icon_d2"
};
const url = "https://api.open-meteo.com/v1/forecast";
const responses = await fetchWeatherApi(url, params);

// Helper function to form time ranges
const range = (start: number, stop: number, step: number) =>
    Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

// Process first location. Add a for-loop for multiple locations or weather models
const response = responses[0];

// Attributes for timezone and location
const utcOffsetSeconds = response.utcOffsetSeconds();
// const timezone = response.timezone();
// const timezoneAbbreviation = response.timezoneAbbreviation();
// const latitude = response.latitude();
// const longitude = response.longitude();

const hourly = response.hourly()!;

// Note: The order of weather variables in the URL query and the indices below need to match!
export const weatherData = {

    hourly: {
        time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
            (t) => new Date((t + utcOffsetSeconds) * 1000)
        ),
        precipitation: hourly.variables(0)!.valuesArray()!,
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

export type WeatherDataType = typeof weatherData;

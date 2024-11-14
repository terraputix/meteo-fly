import type { FlatVariable, ProfileVariables } from "./types";

export const cloudProfile: ProfileVariables = {
    key: "cloudCoverProfile",
    type: "Profile",
    apiNames: [
        "cloud_cover_1000hPa",
        "cloud_cover_975hPa",
        "cloud_cover_950hPa",
        "cloud_cover_925hPa",
        "cloud_cover_900hPa",
        "cloud_cover_850hPa",
        "cloud_cover_800hPa",
        "cloud_cover_700hPa",
        "cloud_cover_600hPa",
        "cloud_cover_500hPa",
        "cloud_cover_400hPa",
        "cloud_cover_300hPa",
        "cloud_cover_250hPa",
        "cloud_cover_200hPa",
        "cloud_cover_150hPa",
        "cloud_cover_100hPa",
        "cloud_cover_70hPa",
        "cloud_cover_50hPa",
        "cloud_cover_30hPa",
    ]
}

export const windSpeedProfile: ProfileVariables = {
    key: "windSpeedProfile",
    type: "Profile",
    apiNames: [
        "wind_speed_1000hPa",
        "wind_speed_975hPa",
        "wind_speed_950hPa",
        "wind_speed_925hPa",
        "wind_speed_900hPa",
        "wind_speed_850hPa",
        "wind_speed_800hPa",
        "wind_speed_700hPa",
        "wind_speed_600hPa",
    ]
}

export const windDirectionProfile: ProfileVariables = {
    key: "windDirectionProfile",
    type: "Profile",
    apiNames: [
        "wind_direction_1000hPa",
        "wind_direction_975hPa",
        "wind_direction_950hPa",
        "wind_direction_925hPa",
        "wind_direction_900hPa",
        "wind_direction_850hPa",
        "wind_direction_800hPa",
        "wind_direction_700hPa",
        "wind_direction_600hPa",
    ]
}

export const variableMappings: (ProfileVariables | FlatVariable)[] = [
    { apiName: "precipitation", type: "Flat", key: "precipitation" },
    { apiName: "temperature_2m", type: "Flat", key: "temperature_2m" },
    { apiName: "dew_point_2m", type: "Flat", key: "dewpoint_2m" },
    { apiName: "cloud_cover", type: "Flat", key: "cloudCover" },
    { apiName: "cloud_cover_low", type: "Flat", key: "cloudCoverLow" },
    { apiName: "cloud_cover_mid", type: "Flat", key: "cloudCoverMid" },
    { apiName: "cloud_cover_high", type: "Flat", key: "cloudCoverHigh" },
    { apiName: "wind_speed_10m", type: "Flat", key: "windSpeed10m" },
    { apiName: "wind_speed_80m", type: "Flat", key: "windSpeed80m" },
    { apiName: "wind_speed_120m", type: "Flat", key: "windSpeed120m" },
    { apiName: "wind_speed_180m", type: "Flat", key: "windSpeed180m" },
    { apiName: "wind_direction_10m", type: "Flat", key: "windDirection10m" },
    { apiName: "wind_direction_80m", type: "Flat", key: "windDirection80m" },
    { apiName: "wind_direction_120m", type: "Flat", key: "windDirection120m" },
    { apiName: "wind_direction_180m", type: "Flat", key: "windDirection180m" },
    cloudProfile,
    windSpeedProfile,
    windDirectionProfile
];

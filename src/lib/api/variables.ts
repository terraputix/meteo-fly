import type { FlatVariable, ProfileVariables, VariableConfig, WeatherModel } from "./types";

// the key is the key in the hourly data object

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

export const verticalVelocityProfile: ProfileVariables = {
    key: "verticalVelocityProfile",
    type: "Profile",
    apiNames: [
        "vertical_velocity_1000hPa",
        "vertical_velocity_975hPa",
        "vertical_velocity_950hPa",
        "vertical_velocity_925hPa",
        "vertical_velocity_900hPa",
        "vertical_velocity_850hPa",
        "vertical_velocity_800hPa",
        "vertical_velocity_700hPa",
        "vertical_velocity_600hPa",
    ]
}

export const variableConfig: VariableConfig = {
    default: [
        { apiName: "precipitation", type: "Flat", key: "precipitation" },
        { apiName: "temperature_2m", type: "Flat", key: "temperature_2m" },
        { apiName: "dew_point_2m", type: "Flat", key: "dewpoint_2m" },
        { apiName: "cloud_cover_low", type: "Flat", key: "cloudCoverLow" },
        { apiName: "cloud_cover_mid", type: "Flat", key: "cloudCoverMid" },
        { apiName: "cloud_cover_high", type: "Flat", key: "cloudCoverHigh" },
        cloudProfile,
        windSpeedProfile,
        windDirectionProfile
    ],
    modelSpecific: {
        'icon_d2': [
        ],
        'icon_global': [
        ],
        'gfs_seamless': [
            verticalVelocityProfile
        ]
    }
};

export function getVariablesForModel(model: WeatherModel): (ProfileVariables | FlatVariable)[] {
    const modelSpecific = variableConfig.modelSpecific?.[model] || [];
    return [...variableConfig.default, ...modelSpecific];
}

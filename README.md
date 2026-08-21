# Meteo-Fly

Meteo-Fly is an experimental browser-based weather visualization tool for paragliders and hang gliders. It combines
an interactive map with forecast charts intended to help inspect weather models and compare conditions.

**Web app:** [meteo-fly.com](https://meteo-fly.com/)

## Features

- Wind, cloud, rain, humidity, cloud-base, profile-based thermal potential, and GFS convective velocity scale
- Skew-T atmospheric soundings
- Multiple ICON, GFS, ECMWF, Meteo-France, UKMO, GEM, and CMA models
- Terrain-aware grid-cell selection and Hike & Fly analysis
- Installable PWA with limited offline caching

Forecast data comes from [Open-Meteo](https://open-meteo.com/). Base maps are provided by
[OpenFreeMap](https://openfreemap.com/) and terrain data by [Mapterhorn](https://mapterhorn.com/).

## Limitations

Meteo-Fly is not flight-safety software. Forecast models and derived values can be wrong, especially for local mountain
weather, valley flows, rotor, thermals, and rapidly changing conditions. Always use current observations and local
knowledge.

## Development

```sh
npm install
npm run dev
```

Before submitting changes:

```sh
npm run check
npm run lint
npm test
```

The application is built with SvelteKit and deployed as a static client-side application.

## Project provenance

Meteo-Fly is a personal project. Approximately 95% of its code was generated with several generations of AI coding
models under human direction and review.

The maintainer works for Open-Meteo. Meteo-Fly is a personal project rather than an official Open-Meteo product.

## License

Meteo-Fly is licensed under the [GNU General Public License version 3](LICENSE).

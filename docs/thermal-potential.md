# Thermal implementation notes

The canonical user-facing explanation is the [About page](../src/routes/about/+page.svelte), published at
`/about#thermal-potential`. Keep terminology, limitations, and general source attribution there. This file only records
implementation contracts that are useful when changing the calculation.

## Data flow

- `fetchSkewTData` requests 2 m temperature/dewpoint, surface pressure, and native pressure-level profiles with
  `elevation=nan`. The Skew-T therefore uses the raw model-grid elevation rather than
  [Open-Meteo elevation downscaling](https://open-meteo.com/en/docs#latitude_and_longitude).
- `buildSkewTData` passes native temperature and geopotential-height levels to `calculateThermalDiagnostics`.
  Interpolated 25 hPa display levels are never diagnostic inputs.
- Only pressure levels above both the model surface pressure and model-grid elevation are used.
- Standard-atmosphere pressure/height conversion is a fallback for missing surface pressure or geopotential height.

## Profile diagnostic contracts

The dry surface parcel and Thermal Index are:

```text
Tparcel(p) = (Tsurface + 273.15) × (p / psurface)^0.2854 − 273.15
TI(p)      = Tenvironment(p) − Tparcel(p)
```

- Usable buoyancy must remain connected to the surface. Instability above a positive-TI cap is ignored.
- The dry top is the first upward `TI = 0` crossing, interpolated linearly in height and logarithmically in pressure.
- A top outside the available profile is retained as an open-ended `>` result.
- The 1,200 m AGL trigger temperature is the warmest dry-adiabatic surface requirement among every intervening native
  level and the interpolated target level. This prevents a lower cap from being skipped.
- LCL pressure is interpolated in log-pressure through the surface and native geopotential-height profile.
- `Cumulus possible` only means the connected dry parcel reaches the LCL; it is not a cloud or precipitation forecast.

## GFS convective velocity scale

Only `gfs_seamless` requests `boundary_layer_height`, `sensible_heat_flux`, and `latent_heat_flux`, following the
[Open-Meteo GFS availability table](https://open-meteo.com/en/docs/gfs-api#models). With positive sensible heat flux,
`calculateThermalStrength` computes the
[Deardorff convective velocity scale](<https://doi.org/10.1175/1520-0469(1970)027%3C1211:CVATSF%3E2.0.CO;2>):

```text
B₀ ≈ g × [H / (ρ cp T) + 0.61 LE / (ρ Lv (1 + 0.61 q))]
w* = (B₀ × boundary-layer height)^(1/3)
```

Specific humidity comes from the 2 m dewpoint and air density from surface pressure and virtual temperature. Missing
latent heat flux produces a sensible-only estimate. The returned `w*` is a Deardorff convective velocity scale, never an
expected vario reading. The UI also exposes the GFS boundary-layer depth so it can be compared with the profile dry top.

GFS surface flux and boundary-layer fields are roughly 13 km data while pressure profiles are roughly 25 km data. Do not
label the combined result as a local or model-independent thermal speed.

## Rendering invariants

- Surface parcel and 2 m markers use hourly surface pressure.
- The parcel and buoyancy shading stop at the dry top.
- The lower shading edge bridges the 2 m parcel origin to the pressure-level temperature trace at the model surface; this
  is visual only and does not change the diagnostic.
- Model-grid elevation is shown as the label of the surface-pressure line. DEM elevation is not used in the Skew-T.

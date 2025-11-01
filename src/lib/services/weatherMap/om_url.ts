import type { Domain } from '@openmeteo/mapbox-layer';

export interface DomainInfo {
  variables: string[];
  valid_times: string[];
  reference_time: string;
}

interface QueryVariables {
  paddedBounds: maplibregl.LngLatBounds | null;
  domain: Domain;
  variable: string;
  datetime: string;
  domainInfo: DomainInfo | null;
}

// Helper function to build the Open-Meteo URL
export const buildOpenMeteoUrl = (state: QueryVariables): string => {
  const { paddedBounds, domain, variable, datetime, domainInfo } = state;

  console.log(variable);

  // Parse the reference time from domain info
  const referenceTimeObj = new Date(domainInfo!.reference_time);
  const refYear = referenceTimeObj.getUTCFullYear();
  const refMonth = String(referenceTimeObj.getUTCMonth() + 1).padStart(2, '0');
  const refDay = String(referenceTimeObj.getUTCDate()).padStart(2, '0');
  const refHour = String(referenceTimeObj.getUTCHours()).padStart(2, '0');
  const refMinute = String(referenceTimeObj.getUTCMinutes()).padStart(2, '0');

  // Format reference time for URL path (HHMMZ)
  const formattedReferenceTime = `${refYear}/${refMonth}/${refDay}/${refHour}${refMinute}Z`;

  // Parse the valid time (datetime from store)
  const validTimeObj = new Date(datetime);
  const validYear = validTimeObj.getUTCFullYear();
  const validMonth = String(validTimeObj.getUTCMonth() + 1).padStart(2, '0');
  const validDay = String(validTimeObj.getUTCDate()).padStart(2, '0');
  const validHour = String(validTimeObj.getUTCHours()).padStart(2, '0');
  const validMinute = String(validTimeObj.getUTCMinutes()).padStart(2, '0');
  // Format valid time for the filename (YYYY-MM-DDTHHMM)
  const formattedValidTime = `${validYear}-${validMonth}-${validDay}T${validHour}${validMinute}`;

  if (!paddedBounds) {
    return `https://map-tiles.open-meteo.com/data_spatial/${domain.value}/${formattedReferenceTime}/${formattedValidTime}.om?variable=${variable}`;
  } else {
    return `https://map-tiles.open-meteo.com/data_spatial/${domain.value}/${formattedReferenceTime}/${formattedValidTime}.om?variable=${variable}&bounds=${paddedBounds.getSouth()},${paddedBounds.getWest()},${paddedBounds.getNorth()},${paddedBounds.getEast()}&partial=true`;
  }
};

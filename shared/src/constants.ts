export const G = 6.67430e-11;
export const C = 299_792_458;
export const AU_M = 149_597_870_700;
export const AU_KM = 149_597_870.7;
export const DAY_SECONDS = 86_400;
export const SOLAR_MASS_KG = 1.98847e30;
export const EARTH_MASS_KG = 5.9722e24;
export const EARTH_RADIUS_KM = 6_371;
export const DEFAULT_SHIP_MASS_KG = 80_000;

export const SCALE_OPTIONS = [
  { id: "compressed", name: "Compressed distance", distanceScale: 10.5, radiusScale: 0.000065 },
  { id: "wide", name: "Wide orbit view", distanceScale: 15.5, radiusScale: 0.000052 },
  { id: "inner", name: "Inner planet focus", distanceScale: 42, radiusScale: 0.000045 }
] as const;

export type ScaleMode = (typeof SCALE_OPTIONS)[number]["id"];

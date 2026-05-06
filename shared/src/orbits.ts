import type { SolarBody } from "./types";

export const J2000_JD = 2_451_545.0;
export const J2000_UNIX_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAY_MS = 86_400_000;

export type Vector3Au = {
  x: number;
  y: number;
  z: number;
};

export type OrbitElementsAtEpoch = {
  semiMajorAxisAu: number;
  eccentricity: number;
  inclinationDeg: number;
  meanLongitudeDeg: number;
  longitudePerihelionDeg: number;
  longitudeAscendingNodeDeg: number;
};

export function daysSinceJ2000Now() {
  return (Date.now() - J2000_UNIX_MS) / DAY_MS;
}

export function dateFromDaysSinceJ2000(daysSinceJ2000: number) {
  return new Date(J2000_UNIX_MS + daysSinceJ2000 * DAY_MS);
}

export function daysSinceJ2000FromDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return daysSinceJ2000Now();
  return (Date.UTC(year, month - 1, day, 12, 0, 0) - J2000_UNIX_MS) / DAY_MS;
}

export function dateInputFromDaysSinceJ2000(daysSinceJ2000: number) {
  return dateFromDaysSinceJ2000(daysSinceJ2000).toISOString().slice(0, 10);
}

export function julianDateFromDaysSinceJ2000(daysSinceJ2000: number) {
  return J2000_JD + daysSinceJ2000;
}

export function orbitalElementsAt(body: SolarBody, daysSinceJ2000: number): OrbitElementsAtEpoch | null {
  if (!body.orbit || body.id === "sun") return null;
  const t = daysSinceJ2000 / 36_525;
  const base = body.orbit;
  const editedSemiMajorAxis = body.semiMajorAxisAu;
  const editedEccentricity = body.eccentricity;
  const basePeriodDays = body.orbitalPeriodDays || 365.256;
  const editedPeriodDays = basePeriodDays * Math.pow(editedSemiMajorAxis / base.semiMajorAxisAu, 1.5);
  const editedOrbit = Math.abs(editedSemiMajorAxis - base.semiMajorAxisAu) > 1e-7 || Math.abs(editedEccentricity - base.eccentricity) > 1e-7;

  return {
    semiMajorAxisAu: editedOrbit ? editedSemiMajorAxis : base.semiMajorAxisAu + base.semiMajorAxisRateAuCy * t,
    eccentricity: editedOrbit ? editedEccentricity : base.eccentricity + base.eccentricityRateCy * t,
    inclinationDeg: base.inclinationDeg + base.inclinationRateDegCy * t,
    meanLongitudeDeg: editedOrbit
      ? base.meanLongitudeDeg + (360 / editedPeriodDays) * daysSinceJ2000
      : base.meanLongitudeDeg + base.meanLongitudeRateDegCy * t,
    longitudePerihelionDeg: base.longitudePerihelionDeg + base.longitudePerihelionRateDegCy * t,
    longitudeAscendingNodeDeg: base.longitudeAscendingNodeDeg + base.longitudeAscendingNodeRateDegCy * t
  };
}

export function heliocentricPositionAu(body: SolarBody, daysSinceJ2000: number): Vector3Au {
  const elements = orbitalElementsAt(body, daysSinceJ2000);
  if (!elements) return { x: 0, y: 0, z: 0 };
  const eccentricAnomalyRad = solveEccentricAnomaly(elements);
  return positionFromEccentricAnomaly(elements, eccentricAnomalyRad);
}

export function orbitalPathAu(body: SolarBody, daysSinceJ2000: number, points: number) {
  const elements = orbitalElementsAt(body, daysSinceJ2000);
  if (!elements) return [];
  return Array.from({ length: points }, (_, index) => {
    const eccentricAnomalyRad = (index / (points - 1)) * Math.PI * 2;
    return positionFromEccentricAnomaly(elements, eccentricAnomalyRad);
  });
}

export function distanceAu(a: Vector3Au, b: Vector3Au) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export function radiusAu(position: Vector3Au) {
  return Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
}

export function perihelionAu(body: SolarBody) {
  return body.semiMajorAxisAu * (1 - body.eccentricity);
}

export function aphelionAu(body: SolarBody) {
  return body.semiMajorAxisAu * (1 + body.eccentricity);
}

function solveEccentricAnomaly(elements: OrbitElementsAtEpoch) {
  const meanAnomalyDeg = normalize180(elements.meanLongitudeDeg - elements.longitudePerihelionDeg);
  const meanAnomalyRad = degToRad(meanAnomalyDeg);
  let eccentricAnomalyRad = meanAnomalyRad + elements.eccentricity * Math.sin(meanAnomalyRad);
  for (let index = 0; index < 8; index += 1) {
    const delta =
      (meanAnomalyRad - (eccentricAnomalyRad - elements.eccentricity * Math.sin(eccentricAnomalyRad))) /
      (1 - elements.eccentricity * Math.cos(eccentricAnomalyRad));
    eccentricAnomalyRad += delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return eccentricAnomalyRad;
}

function positionFromEccentricAnomaly(elements: OrbitElementsAtEpoch, eccentricAnomalyRad: number): Vector3Au {
  const e = elements.eccentricity;
  const xPrime = elements.semiMajorAxisAu * (Math.cos(eccentricAnomalyRad) - e);
  const yPrime = elements.semiMajorAxisAu * Math.sqrt(Math.max(0, 1 - e ** 2)) * Math.sin(eccentricAnomalyRad);
  const inclinationRad = degToRad(elements.inclinationDeg);
  const nodeRad = degToRad(elements.longitudeAscendingNodeDeg);
  const perihelionArgumentRad = degToRad(elements.longitudePerihelionDeg - elements.longitudeAscendingNodeDeg);
  const cosOmega = Math.cos(nodeRad);
  const sinOmega = Math.sin(nodeRad);
  const cosI = Math.cos(inclinationRad);
  const sinI = Math.sin(inclinationRad);
  const cosW = Math.cos(perihelionArgumentRad);
  const sinW = Math.sin(perihelionArgumentRad);

  return {
    x: (cosW * cosOmega - sinW * sinOmega * cosI) * xPrime + (-sinW * cosOmega - cosW * sinOmega * cosI) * yPrime,
    y: (cosW * sinOmega + sinW * cosOmega * cosI) * xPrime + (-sinW * sinOmega + cosW * cosOmega * cosI) * yPrime,
    z: sinW * sinI * xPrime + cosW * sinI * yPrime
  };
}

function normalize180(degrees: number) {
  const normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

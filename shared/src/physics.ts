import {
  AU_M,
  C,
  DAY_SECONDS,
  DEFAULT_SHIP_MASS_KG,
  EARTH_MASS_KG,
  EARTH_RADIUS_KM,
  G,
  SOLAR_MASS_KG
} from "./constants";
import type { BlackHoleState, EditedEarthState, PhysicsReadout, RelativityReadout } from "./types";

export function surfaceGravity(massKg: number, radiusKm: number) {
  return (G * massKg) / (radiusKm * 1000) ** 2;
}

export function escapeVelocityKmS(massKg: number, radiusKm: number) {
  return Math.sqrt((2 * G * massKg) / (radiusKm * 1000)) / 1000;
}

export function circularOrbitalSpeedKmS(centralMassKg: number, distanceAu: number) {
  return Math.sqrt((G * centralMassKg) / (distanceAu * AU_M)) / 1000;
}

export function orbitalPeriodDays(centralMassKg: number, distanceAu: number) {
  const seconds = 2 * Math.PI * Math.sqrt((distanceAu * AU_M) ** 3 / (G * centralMassKg));
  return seconds / DAY_SECONDS;
}

export function densityMassKg(radiusKm: number, densityKgM3: number) {
  return (4 / 3) * Math.PI * (radiusKm * 1000) ** 3 * densityKgM3;
}

export function schwarzschildRadiusKm(massKg: number) {
  return (2 * G * massKg) / C ** 2 / 1000;
}

export function lorentzGamma(speedFractionC: number) {
  const beta = clamp(speedFractionC, 0, 0.999999);
  return 1 / Math.sqrt(1 - beta ** 2);
}

export function lightDeflectionRadians(schwarzschildRadiusKmValue: number, impactParameterKm: number) {
  if (impactParameterKm <= 0) return Number.POSITIVE_INFINITY;
  return (2 * schwarzschildRadiusKmValue) / impactParameterKm;
}

export function calculateEarthPhysics(earth: EditedEarthState): PhysicsReadout {
  const radiusM = earth.radiusKm * 1000;
  const distanceM = earth.orbitalDistanceAu * AU_M;
  const speedMs = earth.orbitalSpeedKmS * 1000;
  const circularSpeed = circularOrbitalSpeedKmS(SOLAR_MASS_KG, earth.orbitalDistanceAu);
  const speedRatio = earth.orbitalSpeedKmS / circularSpeed;
  const stability =
    speedRatio < 0.92 ? "slow" : speedRatio > 1.08 ? "fast" : "stable";
  const stabilityMessage =
    stability === "stable"
      ? "Near circular-orbit speed for this distance."
      : stability === "slow"
        ? "Too slow for a circular orbit; the path would fall inward in a Newtonian model."
        : "Too fast for a circular orbit; the path would stretch outward or escape.";

  return {
    surfaceGravityMs2: surfaceGravity(earth.massKg, earth.radiusKm),
    escapeVelocityKmS: escapeVelocityKmS(earth.massKg, earth.radiusKm),
    circularOrbitalSpeedKmS: circularSpeed,
    orbitalPeriodDays: orbitalPeriodDays(SOLAR_MASS_KG, earth.orbitalDistanceAu),
    sunEarthForceN: (G * SOLAR_MASS_KG * earth.massKg) / distanceM ** 2,
    orbitalAccelerationMs2: (G * SOLAR_MASS_KG) / distanceM ** 2,
    kineticEnergyJ: 0.5 * earth.massKg * speedMs ** 2,
    potentialEnergyJ: -(G * SOLAR_MASS_KG * earth.massKg) / distanceM,
    angularMomentum: earth.massKg * distanceM * speedMs,
    stability,
    stabilityMessage
  };
}

export function calculateRelativity(state: BlackHoleState): RelativityReadout {
  const massKg = state.massSolar * SOLAR_MASS_KG;
  const rsKm = schwarzschildRadiusKm(massKg);
  const observationRadiusKm = rsKm * state.observationRadiusMultiplier;
  const impactMultiplier = Math.max(state.lightImpactMultiplier || state.observationRadiusMultiplier, 1.000001);
  const lightImpactParameterKm = rsKm * impactMultiplier;
  const lightDeflectionRad = lightDeflectionRadians(rsKm, lightImpactParameterKm);
  const lightDeflectionDeg = lightDeflectionRad * (180 / Math.PI);
  const lightDeflectionArcsec = lightDeflectionDeg * 3600;
  const safeMultiplier = Math.max(state.observationRadiusMultiplier, 1.000001);
  const dilation = Math.sqrt(Math.max(0, 1 - 1 / safeMultiplier));
  const redshiftZ = dilation > 0 ? 1 / dilation - 1 : Number.POSITIVE_INFINITY;
  const beta = clamp(state.shipSpeedFractionC, 0.001, 0.999999);
  const gamma = lorentzGamma(beta);
  const distanceM = state.launchDistanceAu * AU_M;
  const outsideTravelDays = distanceM / (beta * C) / DAY_SECONDS;
  const shipProperTravelDays = outsideTravelDays / gamma;
  const warning =
    state.observationRadiusMultiplier <= 1
      ? "Inside the event horizon: this simplified outside-observer formula no longer applies."
      : state.observationRadiusMultiplier < 1.5
        ? "Inside the photon-sphere zone: stable circular paths are not available in this simple model."
        : state.observationRadiusMultiplier < 3
          ? "Below the ISCO: stable circular orbit assumptions break down."
          : null;

  return {
    schwarzschildRadiusKm: rsKm,
    photonSphereKm: 1.5 * rsKm,
    iscoKm: 3 * rsKm,
    observationRadiusKm,
    lightImpactParameterKm,
    lightDeflectionRad,
    lightDeflectionDeg,
    lightDeflectionArcsec,
    timeDilationFactor: dilation,
    redshiftZ,
    outsideTravelDays,
    shipProperTravelDays,
    lorentzGamma: gamma,
    lengthContractionFactor: 1 / gamma,
    warning
  };
}

export function calculateShipEnergy(speedFractionC: number, shipMassKg = DEFAULT_SHIP_MASS_KG) {
  const speed = clamp(speedFractionC, 0, 0.999999) * C;
  return 0.5 * shipMassKg * speed ** 2;
}

export function earthRadiusDeltaPercent(radiusKm: number) {
  return ((radiusKm - EARTH_RADIUS_KM) / EARTH_RADIUS_KM) * 100;
}

export function earthMassDeltaPercent(massKg: number) {
  return ((massKg - EARTH_MASS_KG) / EARTH_MASS_KG) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type CelestialKind = "star" | "terrestrial" | "gas-giant" | "ice-giant";

export type SolarBody = {
  id: string;
  name: string;
  kind: CelestialKind;
  color: string;
  atmosphereColor?: string;
  massKg: number;
  radiusKm: number;
  semiMajorAxisAu: number;
  orbitalPeriodDays: number;
  orbitalSpeedKmS: number;
  eccentricity: number;
  inclinationDeg: number;
  axialTiltDeg: number;
  rotationPeriodHours: number;
  densityKgM3: number;
  overview: string;
};

export type EditedEarthState = {
  radiusKm: number;
  massKg: number;
  orbitalDistanceAu: number;
  orbitalSpeedKmS: number;
  constantDensity: boolean;
};

export type BlackHoleState = {
  massSolar: number;
  shipSpeedFractionC: number;
  observationRadiusMultiplier: number;
  lightImpactMultiplier: number;
  launchDistanceAu: number;
};

export type RelativityReadout = {
  schwarzschildRadiusKm: number;
  photonSphereKm: number;
  iscoKm: number;
  observationRadiusKm: number;
  lightImpactParameterKm: number;
  lightDeflectionRad: number;
  lightDeflectionDeg: number;
  lightDeflectionArcsec: number;
  timeDilationFactor: number;
  redshiftZ: number;
  outsideTravelDays: number;
  shipProperTravelDays: number;
  lorentzGamma: number;
  lengthContractionFactor: number;
  warning: string | null;
};

export type PhysicsReadout = {
  surfaceGravityMs2: number;
  escapeVelocityKmS: number;
  circularOrbitalSpeedKmS: number;
  orbitalPeriodDays: number;
  sunEarthForceN: number;
  orbitalAccelerationMs2: number;
  kineticEnergyJ: number;
  potentialEnergyJ: number;
  angularMomentum: number;
  stability: "stable" | "slow" | "fast";
  stabilityMessage: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatSceneContext = {
  selectedBody: string;
  mode: "solar" | "black-hole";
  earth: EditedEarthState;
  blackHole: BlackHoleState;
  physics: PhysicsReadout;
  relativity: RelativityReadout;
};

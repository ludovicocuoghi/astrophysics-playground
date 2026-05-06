import { describe, expect, it } from "vitest";
import { EARTH_MASS_KG, EARTH_RADIUS_KM } from "../shared/src/constants";
import {
  calculateEarthPhysics,
  calculateRelativity,
  circularOrbitalSpeedKmS,
  escapeVelocityKmS,
  surfaceGravity
} from "../shared/src/physics";
import { earthDefaults } from "../shared/src/solarSystem";

describe("physics formulas", () => {
  it("calculates Earth gravity and escape velocity close to real values", () => {
    expect(surfaceGravity(EARTH_MASS_KG, EARTH_RADIUS_KM)).toBeCloseTo(9.82, 1);
    expect(escapeVelocityKmS(EARTH_MASS_KG, EARTH_RADIUS_KM)).toBeCloseTo(11.19, 1);
  });

  it("calculates Earth's circular orbital speed near 29.8 km/s", () => {
    expect(circularOrbitalSpeedKmS(1.98847e30, 1)).toBeCloseTo(29.78, 1);
  });

  it("marks edited Earth orbital speed stability", () => {
    const normal = calculateEarthPhysics(earthDefaults);
    expect(normal.stability).toBe("stable");
    const slow = calculateEarthPhysics({ ...earthDefaults, orbitalSpeedKmS: 20 });
    expect(slow.stability).toBe("slow");
    const fast = calculateEarthPhysics({ ...earthDefaults, orbitalSpeedKmS: 36 });
    expect(fast.stability).toBe("fast");
  });

  it("calculates Schwarzschild black-hole zones and time dilation", () => {
    const readout = calculateRelativity({
      massSolar: 10,
      shipSpeedFractionC: 0.7,
      observationRadiusMultiplier: 3,
      lightImpactMultiplier: 12,
      launchDistanceAu: 1
    });
    expect(readout.schwarzschildRadiusKm).toBeGreaterThan(29);
    expect(readout.photonSphereKm).toBeCloseTo(readout.schwarzschildRadiusKm * 1.5, 5);
    expect(readout.iscoKm).toBeCloseTo(readout.schwarzschildRadiusKm * 3, 5);
    expect(readout.timeDilationFactor).toBeCloseTo(Math.sqrt(2 / 3), 4);
    expect(readout.lightDeflectionRad).toBeCloseTo(2 / 12, 4);
    expect(readout.lorentzGamma).toBeGreaterThan(1);
  });
});

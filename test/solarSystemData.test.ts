import { describe, expect, it } from "vitest";
import { solarBodies } from "../shared/src/solarSystem";

describe("solar-system data", () => {
  it("includes the Sun and all eight planets in order", () => {
    expect(solarBodies.map((body) => body.id)).toEqual([
      "sun",
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune"
    ]);
  });

  it("has physically sane values for study readouts", () => {
    for (const body of solarBodies) {
      expect(body.massKg, `${body.name} mass`).toBeGreaterThan(0);
      expect(body.radiusKm, `${body.name} radius`).toBeGreaterThan(0);
      expect(body.densityKgM3, `${body.name} density`).toBeGreaterThan(0);
      expect(Number.isFinite(body.rotationPeriodHours), `${body.name} rotation`).toBe(true);

      if (body.id !== "sun") {
        expect(body.semiMajorAxisAu, `${body.name} orbit distance`).toBeGreaterThan(0);
        expect(body.orbitalPeriodDays, `${body.name} orbital period`).toBeGreaterThan(0);
        expect(body.orbitalSpeedKmS, `${body.name} orbital speed`).toBeGreaterThan(0);
        expect(body.eccentricity, `${body.name} eccentricity`).toBeGreaterThanOrEqual(0);
        expect(body.eccentricity, `${body.name} eccentricity`).toBeLessThan(1);
      }
    }
  });

  it("keeps outer planets slower and farther than inner planets", () => {
    const earth = solarBodies.find((body) => body.id === "earth")!;
    const neptune = solarBodies.find((body) => body.id === "neptune")!;

    expect(neptune.semiMajorAxisAu).toBeGreaterThan(earth.semiMajorAxisAu);
    expect(neptune.orbitalPeriodDays).toBeGreaterThan(earth.orbitalPeriodDays);
    expect(neptune.orbitalSpeedKmS).toBeLessThan(earth.orbitalSpeedKmS);
  });
});

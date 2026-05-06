import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkedFiles = [
  "client/src/App.tsx",
  "shared/src/lessons.ts",
  "README.md"
];

describe("product physics text", () => {
  it("does not use ambiguous equation shorthand in visible copy", () => {
    const visibleText = checkedFiles.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(visibleText).not.toMatch(/\bc2\b/);
    expect(visibleText).not.toMatch(/\bv2\b/);
    expect(visibleText).not.toMatch(/m\/s2/);
    expect(visibleText).toContain("c^2");
    expect(visibleText).toContain("m/s^2");
    expect(visibleText).toContain("F = G m1 m2 / r^2");
    expect(visibleText).toContain("v = sqrt(GM / r)");
    expect(visibleText).toContain("alpha ~= 4GM / (c^2 b)");
  });
});

import { describe, expect, it } from "vitest";
import { rotatedDimensions } from "./rotate-image-file";

describe("rotatedDimensions", () => {
  it("intercambia ancho y alto para 90 grados", () => {
    expect(rotatedDimensions(800, 600, 90)).toEqual({ width: 600, height: 800 });
  });

  it("intercambia ancho y alto para 270 grados", () => {
    expect(rotatedDimensions(800, 600, 270)).toEqual({ width: 600, height: 800 });
  });

  it("mantiene ancho y alto para 180 grados", () => {
    expect(rotatedDimensions(800, 600, 180)).toEqual({ width: 800, height: 600 });
  });
});

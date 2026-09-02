import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/llm/read-menu", () => ({ readMenu: vi.fn() }));
vi.mock("@/lib/nutrition/api-ninjas", () => ({ groundMacrosBatch: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { POST } from "./route";
import { readMenu } from "@/lib/llm/read-menu";
import { groundMacrosBatch } from "@/lib/nutrition/api-ninjas";
import { createClient } from "@/lib/supabase/server";

const mockedReadMenu = vi.mocked(readMenu);
const mockedGroundMacrosBatch = vi.mocked(groundMacrosBatch);
const mockedCreateClient = vi.mocked(createClient);

const approx = { kcal: 500, protein_g: 30, carbs_g: 40, fat_g: 15 };

function llmDish(overrides: Partial<Awaited<ReturnType<typeof readMenu>>["dishes"][number]> = {}) {
  return {
    name: "Pollo a la plancha",
    verdict: "green" as const,
    reason: "Alto en proteína",
    nutrition_query: "150g grilled chicken breast",
    approx,
    assumptions: "ración media",
    conflicts: [],
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    goal: "cut",
    profileSnapshot: {
      mealKcal: 600,
      mealProtein: 40,
      diet: "none",
      allergies: [],
      allergiesExtra: [],
      dislikes: [],
      dislikesExtra: [],
      fatLimitG: null,
      carbLimitG: null,
      ...overrides,
    },
  };
}

function buildRequest(files: File[], body: unknown = payload()) {
  const formData = new FormData();
  for (const f of files) formData.append("files", f);
  formData.append("payload", JSON.stringify(body));
  return new NextRequest("http://localhost/api/analyze", { method: "POST", body: formData });
}

function jpegFile(name = "menu.jpg") {
  return new File(["fake-image-bytes"], name, { type: "image/jpeg" });
}

function anonClient() {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateClient.mockResolvedValue(anonClient() as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe("POST /api/analyze — validation", () => {
  it("rejects 0 files", async () => {
    const res = await POST(buildRequest([]));
    expect(res.status).toBe(400);
  });

  it("rejects more than 4 files", async () => {
    const res = await POST(buildRequest([jpegFile("a.jpg"), jpegFile("b.jpg"), jpegFile("c.jpg"), jpegFile("d.jpg"), jpegFile("e.jpg")]));
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported media type", async () => {
    const res = await POST(buildRequest([new File(["x"], "menu.gif", { type: "image/gif" })]));
    expect(res.status).toBe(400);
  });

  it("rejects payload that isn't valid JSON", async () => {
    const formData = new FormData();
    formData.append("files", jpegFile());
    formData.append("payload", "{not json");
    const res = await POST(new NextRequest("http://localhost/api/analyze", { method: "POST", body: formData }));
    expect(res.status).toBe(400);
  });

  it("rejects payload that fails schema validation", async () => {
    const res = await POST(buildRequest([jpegFile()], { goal: "not-a-goal", profileSnapshot: payload().profileSnapshot }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/analyze — LLM pipeline", () => {
  it("returns 502 when readMenu throws", async () => {
    mockedReadMenu.mockRejectedValue(new Error("Claude vision falló"));
    const res = await POST(buildRequest([jpegFile()]));
    expect(res.status).toBe(502);
  });

  it("returns an empty result without calling groundMacrosBatch when menu_read_ok is false", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: false, dishes: [], notes: "carta borrosa" });
    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.menuReadOk).toBe(false);
    expect(body.dishes).toEqual([]);
    expect(body.analysisId).toBeNull();
    expect(mockedGroundMacrosBatch).not.toHaveBeenCalled();
  });
});

describe("POST /api/analyze — scoring/hardRed", () => {
  it("forces red when the LLM declares a conflict even if grounded macros are null (approx-only fallback)", async () => {
    mockedReadMenu.mockResolvedValue({
      menu_read_ok: true,
      dishes: [llmDish({ conflicts: ["gluten"] })],
      notes: undefined,
    });
    mockedGroundMacrosBatch.mockResolvedValue([null]);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.dishes[0].verdict).toBe("red");
    expect(body.dishes[0].conflicts).toContain("gluten");
    expect(body.dishes[0].groundedMacros).toBeNull();
  });

  it("forces red via a numeric fatLimitG exceeded, with a readable reason", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: true, dishes: [llmDish()], notes: undefined });
    mockedGroundMacrosBatch.mockResolvedValue([
      { kcal: 700, protein_g: 30, carbs_g: 20, fat_g: 34, confidence: "high", breakdown: [] },
    ]);

    const res = await POST(buildRequest([jpegFile()], payload({ fatLimitG: 20 })));
    const body = await res.json();
    expect(body.dishes[0].verdict).toBe("red");
    expect(body.dishes[0].conflicts).toEqual(["Supera límite de grasa (34g > 20g/comida)"]);
  });

  it("falls back to the LLM's draft verdict when grounded macros are null and there's no conflict", async () => {
    mockedReadMenu.mockResolvedValue({
      menu_read_ok: true,
      dishes: [llmDish({ verdict: "green", conflicts: [] })],
      notes: undefined,
    });
    mockedGroundMacrosBatch.mockResolvedValue([null]);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.dishes[0].verdict).toBe("green");
  });

  it("sorts dishes by verdict rank (green < amber < red) then by fitScore descending", async () => {
    mockedReadMenu.mockResolvedValue({
      menu_read_ok: true,
      dishes: [
        llmDish({ name: "Rojo", conflicts: ["cacahuete"] }),
        llmDish({ name: "Verde", verdict: "green", conflicts: [] }),
        llmDish({ name: "Ambar", verdict: "amber", conflicts: [] }),
      ],
      notes: undefined,
    });
    mockedGroundMacrosBatch.mockResolvedValue([null, null, null]);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    const names = body.dishes.map((d: { name: string }) => d.name);
    expect(names).toEqual(["Verde", "Ambar", "Rojo"]);
  });
});

describe("POST /api/analyze — persistence (D1: anonymous never writes rows)", () => {
  it("returns analysisId: null and never touches supabase.from when the user is anonymous", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: true, dishes: [llmDish()], notes: undefined });
    mockedGroundMacrosBatch.mockResolvedValue([null]);
    const from = vi.fn();
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.analysisId).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("persists and returns the new analysisId when the user is authenticated", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: true, dishes: [llmDish()], notes: undefined });
    mockedGroundMacrosBatch.mockResolvedValue([null]);

    const analysesTable = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "analysis-123" }, error: null }),
        }),
      }),
    };
    const dishesTable = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: "dish-1", rank: 0 }], error: null }),
      }),
    };
    const from = vi.fn((table: string) => (table === "analyses" ? analysesTable : dishesTable));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.analysisId).toBe("analysis-123");
    expect(dishesTable.insert).toHaveBeenCalled();
  });

  it("adjunta el id de cada fila insertada a su dish correspondiente en la respuesta", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: true, dishes: [llmDish()], notes: undefined });
    mockedGroundMacrosBatch.mockResolvedValue([null]);

    const analysesTable = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "analysis-123" }, error: null }),
        }),
      }),
    };
    const dishesTable = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: "dish-1", rank: 0 }], error: null }),
      }),
    };
    const from = vi.fn((table: string) => (table === "analyses" ? analysesTable : dishesTable));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.dishes[0].id).toBe("dish-1");
    expect(body.dishes[0].eatenAt).toBeNull();
  });

  it("mapea el id de cada dish por su `rank` devuelto, no por el orden de las filas del insert (Important #2)", async () => {
    mockedReadMenu.mockResolvedValue({
      menu_read_ok: true,
      dishes: [llmDish({ name: "Plato 1" }), llmDish({ name: "Plato 2" })],
      notes: undefined,
    });
    mockedGroundMacrosBatch.mockResolvedValue([null, null]);

    const analysesTable = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "analysis-123" }, error: null }),
        }),
      }),
    };
    const dishesTable = {
      insert: vi.fn().mockReturnValue({
        // El orden de retorno de PostgREST no está garantizado — devolvemos las filas
        // deliberadamente en orden INVERSO al de inserción (rank 1 antes que rank 0).
        select: vi.fn().mockResolvedValue({
          data: [
            { id: "dish-2", rank: 1 },
            { id: "dish-1", rank: 0 },
          ],
          error: null,
        }),
      }),
    };
    const from = vi.fn((table: string) => (table === "analyses" ? analysesTable : dishesTable));
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();

    const plato1 = body.dishes.find((d: { name: string }) => d.name === "Plato 1");
    const plato2 = body.dishes.find((d: { name: string }) => d.name === "Plato 2");
    expect(plato1.id).toBe("dish-1");
    expect(plato2.id).toBe("dish-2");
  });

  it("anónimo: cada dish lleva id null (nunca se insertó nada)", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: true, dishes: [llmDish()], notes: undefined });
    mockedGroundMacrosBatch.mockResolvedValue([null]);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.dishes[0].id).toBeNull();
    expect(body.dishes[0].eatenAt).toBeNull();
  });

  it("swallows a persistence error and still returns the computed pipeline result", async () => {
    mockedReadMenu.mockResolvedValue({ menu_read_ok: true, dishes: [llmDish()], notes: undefined });
    mockedGroundMacrosBatch.mockResolvedValue([null]);

    const analysesTable = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } }),
        }),
      }),
    };
    const from = vi.fn(() => analysesTable);
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from,
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await POST(buildRequest([jpegFile()]));
    const body = await res.json();
    expect(body.analysisId).toBeNull();
    expect(body.dishes).toHaveLength(1);
  });
});

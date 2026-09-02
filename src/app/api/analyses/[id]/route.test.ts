import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function ctx(id = "a1") {
  return { params: Promise.resolve({ id }) };
}

function analysesTable(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

function dishesTable(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function clientWith(
  user: { id: string } | null,
  analysesResult: { data: unknown; error: unknown },
  dishesResult: { data: unknown; error: unknown } = { data: [], error: null }
) {
  const analyses = analysesTable(analysesResult);
  const dishes = dishesTable(dishesResult);
  const from = vi.fn((table: string) => (table === "analyses" ? analyses : dishes));
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/analyses/[id]", () => {
  it("returns 401 when there's no authenticated user", async () => {
    mockedCreateClient.mockResolvedValue(clientWith(null, { data: null, error: null }));
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the analysis doesn't exist or isn't owned by the user", async () => {
    mockedCreateClient.mockResolvedValue(clientWith({ id: "user-1" }, { data: null, error: null }));
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 500 when the analysis query errors", async () => {
    mockedCreateClient.mockResolvedValue(
      clientWith({ id: "user-1" }, { data: null, error: { message: "db down" } })
    );
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(500);
  });

  it("returns 500 when the dishes query errors", async () => {
    mockedCreateClient.mockResolvedValue(
      clientWith(
        { id: "user-1" },
        {
          data: { id: "a1", created_at: "2026-08-01T00:00:00Z", source_type: "image", status: "done", notes: null, goal_snapshot: {} },
          error: null,
        },
        { data: null, error: { message: "dishes query failed" } }
      )
    );
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(500);
  });

  it("returns the full analysis detail with mapped dish rows on success", async () => {
    mockedCreateClient.mockResolvedValue(
      clientWith(
        { id: "user-1" },
        {
          data: { id: "a1", created_at: "2026-08-01T00:00:00Z", source_type: "image", status: "done", notes: null, goal_snapshot: { goal: "cut" } },
          error: null,
        },
        {
          data: [
            {
              id: "dish-1",
              name: "Pollo",
              reason: "Alta proteína",
              nutrition_query: "150g grilled chicken breast",
              assumptions: "ración media",
              conflicts: [],
              approx_macros: { kcal: 500, protein_g: 30, carbs_g: 40, fat_g: 15 },
              grounded_macros: null,
              final_verdict: "green",
              fit_score: 80,
              eaten_at: null,
              verdict_feedback: null,
            },
          ],
          error: null,
        }
      )
    );

    const res = await GET(new Request("http://localhost"), ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.dishCount).toBe(1);
    expect(body.dishes[0]).toMatchObject({ name: "Pollo", verdict: "green", fitScore: 80 });
  });
});

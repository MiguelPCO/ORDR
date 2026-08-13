import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function clientWith(user: { id: string } | null, queryResult: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(queryResult);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/analyses", () => {
  it("returns 401 when there's no authenticated user", async () => {
    mockedCreateClient.mockResolvedValue(clientWith(null, { data: null, error: null }));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 500 when the Supabase query errors", async () => {
    mockedCreateClient.mockResolvedValue(
      clientWith({ id: "user-1" }, { data: null, error: { message: "db down" } })
    );
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("maps rows to AnalysisSummary, deriving dishCount from the joined dishes(id) array", async () => {
    mockedCreateClient.mockResolvedValue(
      clientWith(
        { id: "user-1" },
        {
          data: [
            {
              id: "a1",
              created_at: "2026-08-01T00:00:00Z",
              source_type: "image",
              status: "done",
              notes: null,
              goal_snapshot: { goal: "cut" },
              dishes: [{ id: "d1" }, { id: "d2" }],
            },
          ],
          error: null,
        }
      )
    );

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.analyses).toHaveLength(1);
    expect(body.analyses[0]).toMatchObject({ id: "a1", dishCount: 2 });
  });
});

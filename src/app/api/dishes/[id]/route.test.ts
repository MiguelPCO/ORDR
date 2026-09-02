import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { PATCH } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function buildRequest(id: string) {
  return new NextRequest(`http://localhost/api/dishes/${id}`, { method: "PATCH" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/dishes/[id]", () => {
  it("devuelve 401 sin sesión", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1"), { params: Promise.resolve({ id: "dish-1" }) });
    expect(res.status).toBe(401);
  });

  it("marca eaten_at = now() cuando estaba null (toggle a comido)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { eaten_at: "2026-09-02T12:00:00.000Z" }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const dishesTable = { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { eaten_at: null }, error: null }) }) }), update };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => dishesTable),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1"), { params: Promise.resolve({ id: "dish-1" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.eatenAt).toBe("2026-09-02T12:00:00.000Z");
    expect(update).toHaveBeenCalledWith({ eaten_at: expect.any(String) });
  });

  it("desmarca (eaten_at = null) cuando ya estaba marcado", async () => {
    const dishesTable = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { eaten_at: "2026-09-01T10:00:00.000Z" }, error: null }) }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { eaten_at: null }, error: null }) }) }) }),
    };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => dishesTable),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1"), { params: Promise.resolve({ id: "dish-1" }) });
    const body = await res.json();
    expect(body.eatenAt).toBeNull();
    expect(dishesTable.update).toHaveBeenCalledWith({ eaten_at: null });
  });

  it("devuelve 404 cuando el dish no existe o no es del usuario (RLS)", async () => {
    const dishesTable = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
    };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => dishesTable),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1"), { params: Promise.resolve({ id: "dish-1" }) });
    expect(res.status).toBe(404);
  });
});

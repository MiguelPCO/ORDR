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

  it("marcar el plato B como comido limpia primero al plato A (mismo analysis_id) para no violar el índice único (Critical #1)", async () => {
    const initialMaybeSingle = vi.fn().mockResolvedValue({
      data: { eaten_at: null, analysis_id: "a1" },
      error: null,
    });
    const initialEq = vi.fn().mockReturnValue({ maybeSingle: initialMaybeSingle });
    const select = vi.fn().mockReturnValue({ eq: initialEq });

    const finalMaybeSingle = vi.fn().mockResolvedValue({
      data: { eaten_at: "2026-09-02T12:00:00.000Z" },
      error: null,
    });
    const finalSelect = vi.fn().mockReturnValue({ maybeSingle: finalMaybeSingle });
    const finalEq = vi.fn().mockReturnValue({ select: finalSelect });

    const clearEq = vi.fn().mockResolvedValue({ error: null });

    const update = vi.fn();
    update.mockReturnValueOnce({ eq: clearEq }); // 1st call: limpia al plato A (sibling clear)
    update.mockReturnValueOnce({ eq: finalEq }); // 2nd call: marca al plato B (target)

    const dishesTable = { select, update };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => dishesTable),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-b"), { params: Promise.resolve({ id: "dish-b" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eatenAt).toBe("2026-09-02T12:00:00.000Z");
    expect(select).toHaveBeenCalledWith("eaten_at, analysis_id");
    // 1a llamada a update: limpia cualquier otro plato marcado en el mismo análisis, ANTES
    // de marcar el plato B — así el índice único nunca ve dos filas no-null a la vez.
    expect(update).toHaveBeenNthCalledWith(1, { eaten_at: null });
    expect(clearEq).toHaveBeenCalledWith("analysis_id", "a1");
    // 2a llamada a update: marca el plato B como comido.
    expect(update).toHaveBeenNthCalledWith(2, { eaten_at: expect.any(String) });
    expect(finalEq).toHaveBeenCalledWith("id", "dish-b");
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

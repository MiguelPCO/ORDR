import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { PATCH } from "./route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function buildRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/dishes/${id}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/dishes/[id]/feedback", () => {
  it("devuelve 401 sin sesión", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1", { agree: true }), {
      params: Promise.resolve({ id: "dish-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("devuelve 400 si el body no trae 'agree' boolean", async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1", { agree: "yes" }), {
      params: Promise.resolve({ id: "dish-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("guarda verdict_feedback = true", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { verdict_feedback: true }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const dishesTable = { update };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => dishesTable),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1", { agree: true }), {
      params: Promise.resolve({ id: "dish-1" }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.verdictFeedback).toBe(true);
    expect(update).toHaveBeenCalledWith({ verdict_feedback: true });
    expect(eq).toHaveBeenCalledWith("id", "dish-1");
  });

  it("devuelve 404 cuando el dish no existe o no es del usuario (RLS)", async () => {
    const dishesTable = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      }),
    };
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: vi.fn(() => dishesTable),
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const res = await PATCH(buildRequest("dish-1", { agree: false }), {
      params: Promise.resolve({ id: "dish-1" }),
    });
    expect(res.status).toBe(404);
  });
});

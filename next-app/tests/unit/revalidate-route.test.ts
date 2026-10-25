import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Both need a running Next.js server; here we only check what the webhook expires.
// (That the pages really update is checked by hand on a production build, see SOLUTION.md.)
const revalidateTag = jest.fn();
const revalidatePath = jest.fn();
jest.mock("next/cache", () => ({ revalidateTag, revalidatePath }));

// Imported after the mock is registered.
const { POST } = jest.requireActual<typeof import("@/app/api/revalidate/route")>(
  "@/app/api/revalidate/route",
);

const SECRET = "test-secret-0123456789";

const post = (body: string | null, authorization: string | null = `Bearer ${SECRET}`) =>
  POST(
    new NextRequest("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: authorization ? { authorization } : {},
      body,
    }),
  );

beforeEach(() => {
  process.env.REVALIDATE_SECRET = SECRET;
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.REVALIDATE_SECRET;
  jest.restoreAllMocks();
  revalidateTag.mockClear();
  revalidatePath.mockClear();
});

describe("POST /api/revalidate", () => {
  it("expires one article and the list", async () => {
    const response = await post('{ "slug": " Caching-Strategies " }');

    expect(response.status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([
      ["articles:list", { expire: 0 }],
      ["article:caching-strategies", { expire: 0 }],
    ]);
    expect(revalidatePath.mock.calls).toEqual([["/articles/[slug]", "page"]]);
  });

  it.each([null, "", "{}"])("expires every article for body %j", async (body) => {
    await post(body);
    expect(revalidateTag.mock.calls).toEqual([["articles", { expire: 0 }]]);
    expect(revalidatePath.mock.calls).toEqual([["/articles", "layout"]]);
  });

  it.each([null, "Bearer wrong", `Bearer ${SECRET}x`])("rejects authorization %j", async (authorization) => {
    const response = await post("{}", authorization);

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["not json", '{ "slug": 42 }', '{ "slug": "" }'])("rejects body %j", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("is disabled when no secret is configured", async () => {
    delete process.env.REVALIDATE_SECRET;

    expect((await post("{}")).status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

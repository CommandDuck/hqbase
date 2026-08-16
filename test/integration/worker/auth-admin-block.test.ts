import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { applyCurrentMigrations } from "./current-migrations";

const origin = "https://hqbase.test";

describe("better-auth admin plugin surface", () => {
  it("blocks /api/auth/admin/* before better-auth's own authorization runs", async () => {
    await applyCurrentMigrations();

    // adminRole shares owner's ac statements (worker/auth/access.ts), so
    // better-auth's own admin-plugin authorization alone cannot stop an
    // admin-role caller from reaching set-role, set-user-password, ban-user,
    // etc. The route itself must refuse this prefix. No session cookie is
    // sent here on purpose: the block must apply before any auth check, not
    // depend on the caller's role. The app's own internal admin flows
    // (worker/auth/user-actions.ts) call auth.handler() in-process and never
    // traverse this route, so this block does not affect them; that path is
    // exercised end-to-end by test/integration/worker/users.test.ts.
    const response = await SELF.fetch(`${origin}/api/auth/admin/set-role`, {
      body: JSON.stringify({ role: "owner", userId: "irrelevant" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN" }
    });
  });
});

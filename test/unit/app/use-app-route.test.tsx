// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { useAppRoute } from "@/lib/use-app-route";
import { renderHook } from "./render-hook";

describe("application route normalization", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("preserves the invitation password route and its setup token", async () => {
    window.history.replaceState(null, "", "/set-password?token=setup-token");

    const hook = await renderHook(() => useAppRoute(undefined), undefined);

    expect(`${window.location.pathname}${window.location.search}`).toBe(
      "/set-password?token=setup-token"
    );
    await hook.unmount();
  });

  it("continues to normalize an unknown app route to the inbox", async () => {
    window.history.replaceState(null, "", "/not-a-screen?source=test");

    const hook = await renderHook(() => useAppRoute(true), undefined);

    expect(`${window.location.pathname}${window.location.search}`).toBe("/inbox?source=test");
    await hook.unmount();
  });
});

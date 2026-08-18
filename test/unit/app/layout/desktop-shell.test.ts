import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appShell = readFileSync(
  new URL("../../../../app/components/layout/app-shell.tsx", import.meta.url),
  "utf8"
);
const desktopLayout = readFileSync(
  new URL("../../../../app/components/layout/desktop-layout.ts", import.meta.url),
  "utf8"
);
const styles = readFileSync(new URL("../../../../app/styles.css", import.meta.url), "utf8");

describe("desktop application shell", () => {
  it("uses a persisted collapsible sidebar with an accessible toggle", () => {
    expect(appShell).toContain("sidebarCollapsedStorageKey");
    expect(appShell).toContain("sidebarCollapsed");
    const sidebar = readFileSync(
      new URL("../../../../app/components/layout/sidebar.tsx", import.meta.url),
      "utf8"
    );
    expect(sidebar).toContain("Show sidebar");
    expect(sidebar).toContain("Hide sidebar");
    expect(sidebar).toContain("sidebarCollapsed");
  });

  it("keeps the conversation list and reader within the desktop shell layout", () => {
    expect(appShell).toContain("desktopShell");
    expect(appShell).toContain("desktop-sidebar");
    expect(appShell).toContain("desktop-content");
  });

  it("keeps the workspace visible on any screen size without a blocking guard", () => {
    expect(desktopLayout).toContain("desktopMinimumWidth = 1024");
    expect(desktopLayout).toContain("desktopMinimumHeight = 600");
    expect(appShell).not.toContain("Make the HQBase window a little larger");
    expect(styles).not.toContain("desktop-window-guard");
  });
});

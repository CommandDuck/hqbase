import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareMigrationPaths,
  listD1MigrationPaths,
  readD1MigrationsRecursively
} from "../../../scripts/d1-migrations.mjs";

const workspaces = [];

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { force: true, recursive: true });
  }
});

describe("D1 migration discovery", () => {
  it("uses the same numeric and nested path order as Wrangler", () => {
    expect(
      [
        "drizzle/20260820221643_baseline.sql",
        "0010_tenth.sql",
        "0002_second.sql",
        "alpha/1_first.sql",
        "alpha/10_tenth.sql"
      ].sort(compareMigrationPaths)
    ).toEqual([
      "0002_second.sql",
      "0010_tenth.sql",
      "alpha/1_first.sql",
      "alpha/10_tenth.sql",
      "drizzle/20260820221643_baseline.sql"
    ]);
  });

  it("finds top-level and nested SQL files and splits their statements", () => {
    const workspace = mkdtempSync(resolve(tmpdir(), "hqbase-migrations-test-"));
    workspaces.push(workspace);
    mkdirSync(resolve(workspace, "drizzle", "meta"), { recursive: true });
    writeFileSync(resolve(workspace, "0001_first.sql"), "SELECT 1;\nSELECT 2;");
    writeFileSync(resolve(workspace, "drizzle", "20260101000000_next.sql"), "SELECT 3;");
    writeFileSync(resolve(workspace, "drizzle", "meta", "snapshot.json"), "{}");

    expect(listD1MigrationPaths(workspace)).toEqual([
      "0001_first.sql",
      "drizzle/20260101000000_next.sql"
    ]);
    expect(readD1MigrationsRecursively(workspace)).toEqual([
      { name: "0001_first.sql", queries: ["SELECT 1", "SELECT 2"] },
      { name: "drizzle/20260101000000_next.sql", queries: ["SELECT 3;"] }
    ]);
  });
});

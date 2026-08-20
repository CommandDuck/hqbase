import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { unstable_splitSqlQuery } from "wrangler";

function leadingMigrationNumber(segment) {
  return Number.parseInt(segment.split("_")[0], 10);
}

function compareSegments(left, right) {
  const leftNumber = leadingMigrationNumber(left);
  const rightNumber = leadingMigrationNumber(right);

  if (leftNumber !== rightNumber) {
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    if (Number.isFinite(leftNumber)) return -1;
    if (Number.isFinite(rightNumber)) return 1;
  }

  return left.localeCompare(right, "en");
}

export function compareMigrationPaths(left, right) {
  const leftSegments = left.split("/");
  const rightSegments = right.split("/");
  const sharedLength = Math.min(leftSegments.length, rightSegments.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const comparison = compareSegments(leftSegments[index], rightSegments[index]);
    if (comparison !== 0) return comparison;
  }

  return leftSegments.length - rightSegments.length;
}

export function listD1MigrationPaths(migrationsDirectory) {
  const paths = [];

  function visit(absoluteDirectory, relativeDirectory = "") {
    const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        visit(join(absoluteDirectory, entry.name), relativePath);
      } else if (entry.isFile() && entry.name.endsWith(".sql")) {
        paths.push(relativePath);
      }
    }
  }

  visit(migrationsDirectory);
  return paths.sort(compareMigrationPaths);
}

export function readD1MigrationsRecursively(migrationsDirectory) {
  return listD1MigrationPaths(migrationsDirectory).map((name) => ({
    name,
    queries: unstable_splitSqlQuery(readFileSync(join(migrationsDirectory, name), "utf8"))
  }));
}

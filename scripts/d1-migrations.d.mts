export type D1Migration = {
  name: string;
  queries: string[];
};

export function compareMigrationPaths(left: string, right: string): number;
export function listD1MigrationPaths(migrationsDirectory: string): string[];
export function readD1MigrationsRecursively(migrationsDirectory: string): D1Migration[];

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { customSchemaObjects } from "../worker/db/schema-custom.ts";
import { readD1MigrationsRecursively } from "./d1-migrations.mjs";

const root = resolve(import.meta.dirname, "..");
const migrationsDirectory = resolve(root, "migrations");
const drizzleDirectory = resolve(migrationsDirectory, "drizzle");

function listFiles(directory, relativeDirectory = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFiles(join(directory, entry.name), relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

function fileContents(directory) {
  return Object.fromEntries(
    listFiles(directory).map((path) => [path, readFileSync(join(directory, path), "utf8")])
  );
}

function writeConfig(path, outputDirectory) {
  writeFileSync(
    path,
    `export default ${JSON.stringify({
      dialect: "sqlite",
      migrations: { prefix: "timestamp" },
      out: relative(root, outputDirectory).replaceAll("\\", "/"),
      schema: resolve(root, "worker/db/schema.ts").replaceAll("\\", "/"),
      strict: true,
      verbose: false
    })};\n`
  );
}

function generateSchema(configPath, name) {
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "node_modules/drizzle-kit/bin.cjs"),
      "generate",
      "--config",
      configPath,
      "--name",
      name
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (result.status !== 0 || /(?:^|\n)Error:/.test(`${result.stdout}${result.stderr}`)) {
    throw new Error(`Drizzle Kit failed:\n${result.stdout}${result.stderr}`);
  }
  return `${result.stdout}${result.stderr}`;
}

function createHistoryDatabase() {
  const database = new DatabaseSync(":memory:");
  for (const migration of readD1MigrationsRecursively(migrationsDirectory)) {
    for (const query of migration.queries) database.exec(query);
  }
  return database;
}

function createGeneratedDatabase(generatedDirectory) {
  const sqlFiles = listFiles(generatedDirectory).filter((path) => path.endsWith(".sql"));
  assert.equal(sqlFiles.length, 1, "A fresh Drizzle generation must contain one SQL migration.");
  const source = readFileSync(join(generatedDirectory, sqlFiles[0]), "utf8");
  const database = new DatabaseSync(":memory:");
  database.exec(source.replaceAll("--> statement-breakpoint", ""));
  return database;
}

function rows(database, query, ...values) {
  return database.prepare(query).all(...values);
}

function schemaObjects(database, type) {
  return rows(
    database,
    "SELECT name, tbl_name AS table_name, sql FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
    type
  );
}

function normalizeDefault(value) {
  if (value === null) return null;
  let normalized = String(value).trim().toLowerCase().replaceAll('"', "'");
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized.replaceAll(" ", "");
}

function tableDetails(database, table) {
  return rows(database, `PRAGMA table_xinfo(${JSON.stringify(table)})`).map((column) => ({
    default: normalizeDefault(column.dflt_value),
    hidden: column.hidden,
    name: column.name,
    // Drizzle emits NOT NULL for every primary key. SQLite can omit the PRAGMA flag for a
    // non-integer primary key even though the column is still the table identity.
    notNull: column.pk ? 1 : column.notnull,
    primaryKey: column.pk,
    type: String(column.type).toLowerCase()
  }));
}

function foreignKeys(database, table) {
  return rows(database, `PRAGMA foreign_key_list(${JSON.stringify(table)})`)
    .map((key) => ({
      from: key.from,
      match: String(key.match).toLowerCase(),
      onDelete: String(key.on_delete).toLowerCase(),
      onUpdate: String(key.on_update).toLowerCase(),
      table: key.table,
      to: key.to
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
}

function unwrapExpression(expression) {
  let value = expression;
  while (value.startsWith("(") && value.endsWith(")")) {
    let depth = 0;
    let wrapsWholeExpression = true;
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] === "(") depth += 1;
      if (value[index] === ")") depth -= 1;
      if (depth === 0 && index < value.length - 1) wrapsWholeExpression = false;
    }
    if (!wrapsWholeExpression) break;
    value = value.slice(1, -1);
  }
  return value;
}

function normalizeExpression(expression) {
  return unwrapExpression(
    expression
      .replace(/["`[\]]/g, "")
      .replace(/\b[a-z_][a-z0-9_]*\./gi, "")
      .replace(/\s+/g, "")
      .replace(/;$/, "")
      .toLowerCase()
  );
}

function checkExpressions(tableSql) {
  const expressions = [];
  const pattern = /\bcheck\s*\(/gi;
  let match = pattern.exec(tableSql);
  while (match !== null) {
    const start = pattern.lastIndex;
    let depth = 1;
    let quote = false;
    let end = start;
    for (; end < tableSql.length && depth > 0; end += 1) {
      const character = tableSql[end];
      if (character === "'" && tableSql[end + 1] === "'") {
        end += 1;
      } else if (character === "'") {
        quote = !quote;
      } else if (!quote && character === "(") {
        depth += 1;
      } else if (!quote && character === ")") {
        depth -= 1;
      }
    }
    expressions.push(normalizeExpression(tableSql.slice(start, end - 1)));
    pattern.lastIndex = end;
    match = pattern.exec(tableSql);
  }
  return expressions.sort();
}

function indexSignatures(database, table, excludedNames) {
  return rows(database, `PRAGMA index_list(${JSON.stringify(table)})`)
    .filter((index) => !excludedNames.has(index.name))
    .map((index) => {
      const columns = rows(database, `PRAGMA index_xinfo(${JSON.stringify(index.name)})`)
        .filter((column) => column.key === 1)
        .map((column) => ({
          collation: String(column.coll).toLowerCase(),
          descending: column.desc,
          name: column.name ?? "<expression>"
        }));
      const sql = rows(
        database,
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
        index.name
      )[0]?.sql;
      const where = typeof sql === "string" ? sql.match(/\bwhere\b([\s\S]*)$/i)?.[1] : undefined;
      return JSON.stringify({
        columns,
        partial: index.partial,
        unique: index.unique,
        where: where ? normalizeExpression(where) : null
      });
    })
    .sort();
}

function assertSchemaParity(history, generated) {
  const historyTables = schemaObjects(history, "table").map((table) => table.name);
  const generatedTables = schemaObjects(generated, "table").map((table) => table.name);
  assert.deepEqual(
    generatedTables,
    historyTables,
    "Drizzle table names differ from migration history."
  );

  const customIndexNames = new Set(
    customSchemaObjects.filter((object) => object.type === "index").map((object) => object.name)
  );
  for (const table of historyTables) {
    assert.deepEqual(
      tableDetails(generated, table),
      tableDetails(history, table),
      `${table}: column definitions differ.`
    );
    assert.deepEqual(
      foreignKeys(generated, table),
      foreignKeys(history, table),
      `${table}: foreign keys differ.`
    );
    assert.deepEqual(
      checkExpressions(schemaObjects(generated, "table").find((item) => item.name === table).sql),
      checkExpressions(schemaObjects(history, "table").find((item) => item.name === table).sql),
      `${table}: check constraints differ.`
    );
    assert.deepEqual(
      indexSignatures(generated, table, new Set()),
      indexSignatures(history, table, customIndexNames),
      `${table}: index definitions differ.`
    );
  }

  const historyCustomObjects = [
    ...schemaObjects(history, "index"),
    ...schemaObjects(history, "trigger")
  ]
    .filter((object) => customSchemaObjects.some((expected) => expected.name === object.name))
    .map((object) => ({
      name: object.name,
      table: object.table_name,
      type: object.sql.startsWith("CREATE TRIGGER") ? "trigger" : "index"
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  assert.deepEqual(
    historyCustomObjects,
    [...customSchemaObjects].sort((left, right) => left.name.localeCompare(right.name, "en")),
    "The required custom indexes and triggers differ from the migration history."
  );
}

// Drizzle Kit resolves its output from the project. Keep the disposable folder on the same drive
// as the checkout so Windows never has to express a cross-drive relative path.
const workspace = mkdtempSync(resolve(root, ".drizzle-schema-check-"));
try {
  const generatedDirectory = resolve(workspace, "generated");
  const generatedConfig = resolve(workspace, "generated.config.mjs");
  writeConfig(generatedConfig, generatedDirectory);
  generateSchema(generatedConfig, "parity");

  const history = createHistoryDatabase();
  const generated = createGeneratedDatabase(generatedDirectory);
  try {
    assertSchemaParity(history, generated);
  } finally {
    history.close();
    generated.close();
  }

  const snapshotDirectory = resolve(workspace, "snapshot");
  cpSync(drizzleDirectory, snapshotDirectory, { recursive: true });
  const before = fileContents(snapshotDirectory);
  const snapshotConfig = resolve(workspace, "snapshot.config.mjs");
  writeConfig(snapshotConfig, snapshotDirectory);
  const output = generateSchema(snapshotConfig, "schema-drift");
  assert.match(output, /No schema changes/i, "The committed Drizzle snapshot is stale.");
  assert.deepEqual(
    fileContents(snapshotDirectory),
    before,
    "The committed Drizzle snapshot is stale."
  );

  console.log("Drizzle schema matches the complete D1 migration history.");
} finally {
  rmSync(workspace, { force: true, recursive: true });
}

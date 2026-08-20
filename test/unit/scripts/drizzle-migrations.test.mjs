import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  listD1MigrationPaths,
  readD1MigrationsRecursively
} from "../../../scripts/d1-migrations.mjs";
import { customSchemaObjects } from "../../../worker/db/schema-custom.ts";

const migrationsDirectory = resolve(import.meta.dirname, "../../../migrations");
const databases = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  databases.push(database);
  return database;
}

function applyMigration(database, migration) {
  const applied = database
    .prepare("SELECT 1 FROM d1_migrations WHERE name = ?")
    .get(migration.name);
  if (applied) return false;

  database.exec("BEGIN");
  try {
    for (const query of migration.queries) database.exec(query);
    database.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(migration.name);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return true;
}

function insertRepresentativeData(database) {
  const timestamp = "2026-08-20T12:00:00.000Z";
  database
    .prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
       VALUES ('usr_upgrade', 'Upgrade', 'upgrade@example.com', 1, ?, ?)`
    )
    .run(timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO account
         (id, issuer, providerAccountId, providerId, userId, createdAt, updatedAt)
       VALUES ('acc_upgrade', 'credential', 'usr_upgrade', 'credential', 'usr_upgrade', ?, ?)`
    )
    .run(timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO mailboxes (id, address, display_name, created_at, updated_at)
       VALUES ('mbx_upgrade', 'mailbox@example.com', 'Mailbox', ?, ?)`
    )
    .run(timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO threads (id, subject_normalized, last_message_at, created_at, updated_at)
       VALUES ('thr_upgrade', 'upgrade', ?, ?, ?)`
    )
    .run(timestamp, timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO messages
         (id, thread_id, mailbox_id, direction, folder, from_address, to_json, cc_json,
          bcc_json, subject, snippet, text_body, references_json, created_at, updated_at)
       VALUES
         ('msg_upgrade', 'thr_upgrade', 'mbx_upgrade', 'inbound', 'inbox',
          'sender@example.com', '["mailbox@example.com"]', '[]', '[]', 'Upgrade',
          'Upgrade message', 'Upgrade message', '[]', ?, ?)`
    )
    .run(timestamp, timestamp);
  database
    .prepare(
      `INSERT INTO drafts
         (id, user_id, mailbox_id, from_address, to_json, cc_json, bcc_json, subject,
          text_body, html_body, created_at, updated_at)
       VALUES
         ('drf_upgrade', 'usr_upgrade', 'mbx_upgrade', 'mailbox@example.com',
          '["reader@example.com"]', '[]', '[]', 'Draft', 'Draft body', '', ?, ?)`
    )
    .run(timestamp, timestamp);
}

function representativeData(database) {
  return {
    account: database.prepare("SELECT id, userId FROM account WHERE id = 'acc_upgrade'").get(),
    draft: database
      .prepare("SELECT id, subject, version FROM drafts WHERE id = 'drf_upgrade'")
      .get(),
    message: database
      .prepare(
        "SELECT id, mailbox_id, subject, is_unassigned FROM messages WHERE id = 'msg_upgrade'"
      )
      .get(),
    user: database.prepare("SELECT id, email FROM user WHERE id = 'usr_upgrade'").get()
  };
}

describe("Drizzle migration contract", () => {
  it("keeps the immutable migrations before one no-op Drizzle baseline", () => {
    const paths = listD1MigrationPaths(migrationsDirectory);
    expect(paths.slice(0, 14)).toEqual(
      Array.from(
        { length: 14 },
        (_, index) =>
          `${String(index + 1).padStart(4, "0")}_${
            [
              "initial",
              "workspace",
              "oauth_resources",
              "conversations",
              "rebuild_threads",
              "push_notifications",
              "user_mail_preferences",
              "user_onboarding",
              "login_email_domain_isolation",
              "oauth_device_authorization",
              "latest_password_reset_token",
              "message_activity_index",
              "message_changes",
              "unassigned_messages"
            ][index]
          }.sql`
      )
    );
    expect(paths).toHaveLength(15);
    expect(paths[14]).toMatch(/^drizzle\/\d{14}_baseline\.sql$/);

    const baseline = readFileSync(resolve(migrationsDirectory, paths[14]), "utf8");
    expect(baseline).toMatch(/Drizzle baseline/);
    expect(baseline).toMatch(/SELECT 1;/);
    expect(baseline).not.toMatch(/\b(?:ALTER|CREATE|DELETE|DROP|INSERT|UPDATE)\b/i);

    const tag = paths[14]
      .split("/")
      .at(-1)
      .replace(/\.sql$/, "");
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDirectory, "drizzle/meta/_journal.json"), "utf8")
    );
    expect(journal.entries.at(-1).tag).toBe(tag);
    expect(
      existsSync(resolve(migrationsDirectory, `drizzle/meta/${tag.split("_")[0]}_snapshot.json`))
    ).toBe(true);
  });

  it("applies every migration to a fresh database", () => {
    const database = createDatabase();
    for (const migration of readD1MigrationsRecursively(migrationsDirectory)) {
      expect(applyMigration(database, migration)).toBe(true);
    }

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => row.name);
    expect(tables).toHaveLength(39);
    for (const object of customSchemaObjects) {
      expect(
        database
          .prepare("SELECT tbl_name FROM sqlite_master WHERE type = ? AND name = ?")
          .get(object.type, object.name)
      ).toEqual({ tbl_name: object.table });
    }
  });

  it("preserves populated data and skips the baseline safely on retry", () => {
    const database = createDatabase();
    const migrations = readD1MigrationsRecursively(migrationsDirectory);
    for (const migration of migrations.slice(0, -1)) applyMigration(database, migration);
    insertRepresentativeData(database);
    const before = representativeData(database);

    expect(applyMigration(database, migrations.at(-1))).toBe(true);
    expect(representativeData(database)).toEqual(before);
    expect(applyMigration(database, migrations.at(-1))).toBe(false);
    expect(representativeData(database)).toEqual(before);
    expect(database.prepare("SELECT count(*) AS count FROM d1_migrations").get()).toEqual({
      count: 15
    });
  });
});

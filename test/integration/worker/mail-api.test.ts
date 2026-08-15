import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import initialMigration from "../../../migrations/0001_initial.sql?raw";
import workspaceMigration from "../../../migrations/0002_workspace.sql?raw";
import oauthResourcesMigration from "../../../migrations/0003_oauth_resources.sql?raw";
import conversationMigration from "../../../migrations/0004_conversations.sql?raw";
import threadRebuildMigration from "../../../migrations/0005_rebuild_threads.sql?raw";
import userOnboardingMigration from "../../../migrations/0008_user_onboarding.sql?raw";
import loginEmailDomainMigration from "../../../migrations/0009_login_email_domain_isolation.sql?raw";
import { createAuth } from "../../../worker/auth/auth";
import { tokenRow } from "./mail-api-token-fixture";
import { migrationStatements } from "./migration-statements";

const origin = "https://hqbase.test";
const apiResource = `${origin}/api/v1`;
const readToken = "hqb_access_mail-api-read-token";
const writeToken = "hqb_access_mail-api-write-token";
const fullToken = "hqb_access_mail-api-full-token";
const wrongAudienceToken = "hqb_access_mail-api-wrong-audience-token";
const revokedToken = "hqb_access_mail-api-revoked-token";
const scopes = ["mail:read", "mail:write", "mail:send"];
let cookie = "";
let userId = "";

describe("HQBase Mail API v1", () => {
  beforeAll(async () => {
    for (const migration of [
      initialMigration,
      workspaceMigration,
      oauthResourcesMigration,
      conversationMigration,
      threadRebuildMigration,
      userOnboardingMigration,
      loginEmailDomainMigration
    ]) {
      await applyMigration(migration);
    }

    const auth = createAuth(env, new Request(`${origin}/api/auth/sign-up/email`));
    const signUp = await auth.handler(
      new Request(`${origin}/api/auth/sign-up/email`, {
        body: JSON.stringify({
          email: "api-member@login.example",
          name: "API Member",
          password: "mail-api-test-password",
          rememberMe: false
        }),
        headers: { "content-type": "application/json", origin },
        method: "POST"
      })
    );
    expect(signUp.status, await signUp.clone().text()).toBe(200);
    cookie = extractSessionCookie(signUp);

    const user = await env.DB.prepare(
      `SELECT u.id, s.id AS sessionId
       FROM "user" u JOIN "session" s ON s.userId = u.id
       WHERE u.email = ? ORDER BY s.createdAt DESC LIMIT 1`
    )
      .bind("api-member@login.example")
      .first<{ id: string; sessionId: string }>();
    if (!user) throw new Error("API test user was not created.");
    userId = user.id;

    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const tokenRows = await Promise.all([
      tokenRow(
        env.DB,
        "tok_api_read",
        readToken,
        "client_mail_api",
        user.sessionId,
        userId,
        future,
        ["mail:read"],
        apiResource
      ),
      tokenRow(
        env.DB,
        "tok_api_write",
        writeToken,
        "client_mail_api",
        user.sessionId,
        userId,
        future,
        ["mail:write"],
        apiResource
      ),
      tokenRow(
        env.DB,
        "tok_api_full",
        fullToken,
        "client_mail_api",
        user.sessionId,
        userId,
        future,
        scopes,
        apiResource
      ),
      tokenRow(
        env.DB,
        "tok_api_wrong",
        wrongAudienceToken,
        "client_mail_mcp",
        user.sessionId,
        userId,
        future,
        ["mail:read"],
        `${origin}/mcp`
      ),
      tokenRow(
        env.DB,
        "tok_api_revoked",
        revokedToken,
        "client_mail_api",
        user.sessionId,
        userId,
        future,
        scopes,
        apiResource,
        now.toISOString()
      )
    ]);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO mailboxes (id, address, display_name, is_active, created_at, updated_at)
         VALUES ('mbx_api', 'support@example.com', 'Support', 1, ?, ?)`
      ).bind(now.toISOString(), now.toISOString()),
      env.DB.prepare(
        `INSERT INTO mail_domains
         (id, name, receiving_status, sending_status, dns_status, is_enabled, created_at, updated_at)
         VALUES ('dom_api', 'example.com', 'ready', 'ready', 'ready', 1, ?, ?)`
      ).bind(now.toISOString(), now.toISOString()),
      env.DB.prepare(
        `INSERT INTO mailbox_addresses
         (id, mailbox_id, mail_domain_id, local_part, address, display_name,
          receive_enabled, send_enabled, is_primary, created_at, updated_at)
         VALUES ('addr_api', 'mbx_api', 'dom_api', 'support', 'support@example.com', 'Support',
                 1, 1, 1, ?, ?)`
      ).bind(now.toISOString(), now.toISOString()),
      env.DB.prepare(
        `INSERT INTO mailbox_grants
         (mailbox_id, user_id, access_level, created_by, created_at, updated_at)
         VALUES ('mbx_api', ?, 'agent', ?, ?, ?)`
      ).bind(userId, userId, now.toISOString(), now.toISOString()),
      env.DB.prepare(
        `INSERT INTO oauthClient
         (id, clientId, disabled, redirectUris, public, requirePKCE, createdAt, updatedAt)
         VALUES ('client_row_api', 'client_mail_api', 0, ?, 1, 1, ?, ?)`
      ).bind(
        JSON.stringify(["https://client.example/callback"]),
        now.toISOString(),
        now.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO oauthConsent
         (id, clientId, userId, scopes, resources, createdAt, updatedAt)
         VALUES ('consent_api', 'client_mail_api', ?, ?, ?, ?, ?)`
      ).bind(
        userId,
        JSON.stringify(scopes),
        JSON.stringify([apiResource]),
        now.toISOString(),
        now.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO oauthClient
         (id, clientId, disabled, redirectUris, public, requirePKCE, createdAt, updatedAt)
         VALUES ('client_row_mcp', 'client_mail_mcp', 0, ?, 1, 1, ?, ?)`
      ).bind(JSON.stringify(["https://client.example/mcp"]), now.toISOString(), now.toISOString()),
      env.DB.prepare(
        `INSERT INTO oauthConsent
         (id, clientId, userId, scopes, resources, createdAt, updatedAt)
         VALUES ('consent_mcp_for_api', 'client_mail_mcp', ?, ?, ?, ?, ?)`
      ).bind(
        userId,
        JSON.stringify(["mail:read"]),
        JSON.stringify([`${origin}/mcp`]),
        now.toISOString(),
        now.toISOString()
      ),
      ...tokenRows,
      env.DB.prepare(
        `INSERT INTO threads (id, subject_normalized, last_message_at, created_at, updated_at)
         VALUES ('thr_api', 'api message', ?, ?, ?)`
      ).bind(now.toISOString(), now.toISOString(), now.toISOString()),
      env.DB.prepare(
        `INSERT INTO messages
         (id, thread_id, mailbox_id, direction, folder, from_address, to_json, cc_json, bcc_json,
          subject, snippet, text_body, message_id, dedupe_key, in_reply_to, references_json,
          received_at, sent_at, read_at, has_attachments, created_at, updated_at)
         VALUES ('msg_api', 'thr_api', 'mbx_api', 'inbound', 'inbox', 'sender@example.net', ?,
                 '[]', '[]', 'API message', 'Body', 'Body', '<api@example.net>', 'api-dedupe',
                 NULL, '[]', ?, NULL, NULL, 1, ?, ?)`
      ).bind(
        JSON.stringify(["support@example.com"]),
        now.toISOString(),
        now.toISOString(),
        now.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO message_attachments
         (id, message_id, filename, content_type, size_bytes, content_id, r2_key, created_at)
         VALUES ('att_api', 'msg_api', 'hello.txt', 'text/plain', 5, NULL, 'mail/api/hello.txt', ?)`
      ).bind(now.toISOString())
    ]);
    await env.MAIL_OBJECTS.put("mail/api/hello.txt", "hello", {
      httpMetadata: { contentType: "text/plain" }
    });
  });

  it("publishes protected-resource metadata and a scoped authentication challenge", async () => {
    const metadata = await SELF.fetch(`${origin}/.well-known/oauth-protected-resource/api/v1`);
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toMatchObject({
      resource: apiResource,
      authorization_servers: [`${origin}/api/auth`],
      scopes_supported: scopes
    });

    const rejected = await SELF.fetch(`${origin}/api/v1/messages`);
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("www-authenticate")).toContain(
      `resource_metadata="${origin}/.well-known/oauth-protected-resource/api/v1"`
    );
    expect(rejected.headers.get("www-authenticate")).toContain('scope="mail:read"');
    expect(rejected.headers.get("x-request-id")).toBeTruthy();
  });

  it("accepts the web session on v1 while legacy mail routes remain cookie-only", async () => {
    const versioned = await SELF.fetch(`${origin}/api/v1/mailboxes`, { headers: { cookie } });
    expect(versioned.status, await versioned.clone().text()).toBe(200);
    await expect(versioned.json()).resolves.toMatchObject([
      { id: "mbx_api", accessLevel: "agent" }
    ]);

    const legacyCookie = await SELF.fetch(`${origin}/api/messages`, { headers: { cookie } });
    expect(legacyCookie.status).toBe(200);
    const legacyBearer = await apiFetch("/api/messages", readToken);
    expect(legacyBearer.status).toBe(401);
  });

  it("reads mail with an audience-bound bearer token without exposing storage keys", async () => {
    const list = await apiFetch("/api/v1/messages", readToken);
    expect(list.status, await list.clone().text()).toBe(200);
    await expect(list.json()).resolves.toMatchObject([{ id: "msg_api" }]);

    const detail = await apiFetch("/api/v1/messages/msg_api", readToken);
    expect(detail.status).toBe(200);
    const payload = (await detail.json()) as { attachments: Array<Record<string, unknown>> };
    expect(payload.attachments[0]).toMatchObject({ id: "att_api", filename: "hello.txt" });
    expect(payload.attachments[0]).not.toHaveProperty("r2Key");

    const attachment = await apiFetch("/api/v1/attachments/att_api", readToken);
    expect(attachment.status).toBe(200);
    expect(await attachment.text()).toBe("hello");
  });

  it("rejects wrong audiences, revoked tokens, and invalid bearer precedence", async () => {
    await expect(apiFetch("/api/v1/messages", wrongAudienceToken)).resolves.toMatchObject({
      status: 401
    });
    await expect(apiFetch("/api/v1/messages", revokedToken)).resolves.toMatchObject({
      status: 401
    });
    const invalidOverCookie = await SELF.fetch(`${origin}/api/v1/messages`, {
      headers: { authorization: "Bearer invalid", cookie }
    });
    expect(invalidOverCookie.status).toBe(401);
  });

  it("returns insufficient_scope before applying write or send actions", async () => {
    const write = await apiFetch("/api/v1/messages/msg_api/read", readToken, { method: "POST" });
    expect(write.status).toBe(403);
    expect(write.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
    expect(write.headers.get("www-authenticate")).toContain('scope="mail:write"');

    const send = await apiFetch("/api/v1/drafts", writeToken, {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    expect(send.status).toBe(403);
    expect(send.headers.get("www-authenticate")).toContain('scope="mail:send"');
  });

  it("uses consent scope intersection and permits full-scope draft creation", async () => {
    await env.DB.prepare("UPDATE oauthConsent SET scopes = ? WHERE id = 'consent_api'")
      .bind(JSON.stringify(["mail:read"]))
      .run();
    try {
      const narrowed = await apiFetch("/api/v1/drafts", fullToken);
      expect(narrowed.status).toBe(403);
    } finally {
      await env.DB.prepare("UPDATE oauthConsent SET scopes = ? WHERE id = 'consent_api'")
        .bind(JSON.stringify(scopes))
        .run();
    }

    const created = await apiFetch("/api/v1/drafts", fullToken, {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    expect(created.status, await created.clone().text()).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ version: 1, attachments: [] });
  });

  it("applies live mailbox grants and does not expose administration under v1", async () => {
    const draftResponse = await apiFetch("/api/v1/drafts", fullToken, {
      body: JSON.stringify({ mailboxId: "mbx_api", from: "support@example.com" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    expect(draftResponse.status, await draftResponse.clone().text()).toBe(201);
    const mailboxDraft = (await draftResponse.json()) as { id: string };

    await env.DB.prepare("DELETE FROM mailbox_grants WHERE mailbox_id = 'mbx_api' AND user_id = ?")
      .bind(userId)
      .run();
    try {
      const hidden = await apiFetch("/api/v1/messages", readToken);
      await expect(hidden.json()).resolves.toEqual([]);
      await expect(apiFetch("/api/v1/messages/msg_api", readToken)).resolves.toMatchObject({
        status: 403
      });
      const drafts = await apiFetch("/api/v1/drafts", fullToken);
      const visibleDrafts = (await drafts.json()) as Array<{ id: string }>;
      expect(visibleDrafts.map(({ id }) => id)).not.toContain(mailboxDraft.id);
      const inaccessibleDraft = await apiFetch(`/api/v1/drafts/${mailboxDraft.id}`, fullToken);
      expect(inaccessibleDraft.status, await inaccessibleDraft.clone().text()).toBe(404);
    } finally {
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO mailbox_grants
         (mailbox_id, user_id, access_level, created_by, created_at, updated_at)
         VALUES ('mbx_api', ?, 'agent', ?, ?, ?)`
      )
        .bind(userId, userId, now, now)
        .run();
    }

    const adminRoute = await apiFetch("/api/v1/users", fullToken);
    expect(adminRoute.status).toBe(404);
  });

  it("dynamically registers a public client for the API resource", async () => {
    const metadata = await SELF.fetch(`${origin}/.well-known/oauth-authorization-server/api/auth`);
    const discovery = (await metadata.json()) as { registration_endpoint?: string };
    const response = await SELF.fetch(discovery.registration_endpoint ?? "", {
      body: JSON.stringify({
        client_name: "Mail API test client",
        redirect_uris: ["https://client.example/api-callback"],
        token_endpoint_auth_method: "none",
        scope: scopes.join(" "),
        resources: [apiResource]
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    expect(response.status, await response.clone().text()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ token_endpoint_auth_method: "none" });
  });
});

function apiFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return SELF.fetch(`${origin}${path}`, { ...init, headers });
}

function extractSessionCookie(response: Response): string {
  const serialized = response.headers.get("set-cookie") ?? "";
  const match = serialized.match(/(?:^|,\s*)((?:__Secure-)?better-auth\.session_token=[^;,]+)/);
  if (!match?.[1]) throw new Error("Session cookie was not returned.");
  return match[1];
}

async function applyMigration(source: string): Promise<void> {
  for (const statement of migrationStatements(source)) {
    await env.DB.prepare(statement).run();
  }
}

import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export * from "./schema-auth";

// Wrangler SQL migrations remain the database schema source. Add a table here only when
// application runtime queries start to use Drizzle.
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey().notNull(),
  value: text("value_json", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey().notNull(),
  occurredAt: text("occurred_at").notNull(),
  correlationId: text("correlation_id").notNull(),
  actorType: text("actor_type", { enum: ["user", "system", "operator"] }).notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  outcome: text("outcome", { enum: ["success", "denied", "failure"] }).notNull(),
  metadata: text("metadata_json", { mode: "json" }).notNull()
});

export const userOnboarding = sqliteTable(
  "user_onboarding",
  {
    userId: text("user_id").primaryKey().notNull(),
    method: text("method", { enum: ["email_invite", "temporary_password"] }).notNull(),
    status: text("status", { enum: ["pending", "complete"] })
      .default("pending")
      .notNull(),
    createdBy: text("created_by"),
    invitationSentAt: text("invitation_sent_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("user_onboarding_status_idx").on(table.status, table.method, table.createdAt)]
);

export const verifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey().notNull(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: text("expiresAt").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull()
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const users = sqliteTable("user", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("banReason"),
  banExpires: text("banExpires")
});

export const sessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey().notNull(),
    expiresAt: text("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull(),
    impersonatedBy: text("impersonatedBy")
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const mailboxes = sqliteTable("mailboxes", {
  id: text("id").primaryKey().notNull(),
  address: text("address").notNull().unique(),
  displayName: text("display_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const workspaceHosts = sqliteTable("workspace_hosts", {
  id: text("id").primaryKey().notNull(),
  hostname: text("hostname").notNull().unique(),
  zoneId: text("zone_id"),
  kind: text("kind", { enum: ["portal"] }).notNull(),
  isCanonical: integer("is_canonical", { mode: "boolean" }).default(false).notNull(),
  status: text("status", { enum: ["pending", "ready", "degraded", "disabled"] })
    .default("ready")
    .notNull(),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const mailboxGrants = sqliteTable(
  "mailbox_grants",
  {
    mailboxId: text("mailbox_id").notNull(),
    userId: text("user_id").notNull(),
    accessLevel: text("access_level", { enum: ["read", "agent", "manager"] }).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.mailboxId, table.userId] }),
    index("mailbox_grants_user_idx").on(table.userId, table.accessLevel, table.mailboxId)
  ]
);

export const retentionPolicies = sqliteTable("retention_policies", {
  mailboxId: text("mailbox_id").primaryKey().notNull(),
  messageDays: integer("message_days"),
  trashDays: integer("trash_days").default(30).notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const mailDomains = sqliteTable("mail_domains", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull().unique(),
  zoneId: text("zone_id"),
  accountId: text("account_id"),
  receivingStatus: text("receiving_status", {
    enum: ["pending", "ready", "degraded", "disabled"]
  })
    .default("pending")
    .notNull(),
  sendingStatus: text("sending_status", {
    enum: ["pending", "ready", "degraded", "disabled"]
  })
    .default("pending")
    .notNull(),
  dnsStatus: text("dns_status", { enum: ["pending", "ready", "degraded"] })
    .default("pending")
    .notNull(),
  catchAllPolicy: text("catch_all_policy", { enum: ["reject", "mailbox", "unassigned"] })
    .default("reject")
    .notNull(),
  catchAllMailboxId: text("catch_all_mailbox_id"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
  lastErrorCode: text("last_error_code"),
  verifiedAt: text("verified_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const mailboxAddresses = sqliteTable(
  "mailbox_addresses",
  {
    id: text("id").primaryKey().notNull(),
    mailboxId: text("mailbox_id").notNull(),
    mailDomainId: text("mail_domain_id").notNull(),
    localPart: text("local_part").notNull(),
    address: text("address").notNull().unique(),
    displayName: text("display_name").notNull(),
    receiveEnabled: integer("receive_enabled", { mode: "boolean" }).default(true).notNull(),
    sendEnabled: integer("send_enabled", { mode: "boolean" }).default(true).notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).default(false).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("mailbox_addresses_mailbox_idx").on(table.mailboxId, table.address)]
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    expirationTime: integer("expiration_time"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastSuccessAt: text("last_success_at")
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId, table.updatedAt)]
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id").notNull(),
    mailboxId: text("mailbox_id"),
    replyToMessageId: text("reply_to_message_id"),
    forwardOfMessageId: text("forward_of_message_id"),
    fromAddress: text("from_address").default("").notNull(),
    to: text("to_json", { mode: "json" }).$type<string[]>().default([]).notNull(),
    cc: text("cc_json", { mode: "json" }).$type<string[]>().default([]).notNull(),
    bcc: text("bcc_json", { mode: "json" }).$type<string[]>().default([]).notNull(),
    subject: text("subject").default("").notNull(),
    textBody: text("text_body").default("").notNull(),
    htmlBody: text("html_body").default("").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("drafts_user_updated_idx").on(table.userId, table.updatedAt)]
);

export const draftAttachments = sqliteTable(
  "draft_attachments",
  {
    id: text("id").primaryKey().notNull(),
    draftId: text("draft_id").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    r2Key: text("r2_key").notNull().unique(),
    createdAt: text("created_at").notNull()
  },
  (table) => [index("draft_attachments_draft_idx").on(table.draftId, table.createdAt)]
);

export const threads = sqliteTable("threads", {
  id: text("id").primaryKey().notNull(),
  subjectNormalized: text("subject_normalized").notNull(),
  lastMessageAt: text("last_message_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().notNull(),
  threadId: text("thread_id").notNull(),
  mailboxId: text("mailbox_id"),
  isUnassigned: integer("is_unassigned", { mode: "boolean" }).default(false).notNull(),
  direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
  folder: text("folder", {
    enum: ["inbox", "sent", "drafts", "archived", "trash", "catchall"]
  }).notNull(),
  fromAddress: text("from_address").notNull(),
  to: text("to_json", { mode: "json" }).$type<string[]>().notNull(),
  cc: text("cc_json", { mode: "json" }).$type<string[]>().notNull(),
  bcc: text("bcc_json", { mode: "json" }).$type<string[]>().notNull(),
  subject: text("subject").notNull(),
  snippet: text("snippet").notNull(),
  textBody: text("text_body").notNull(),
  htmlR2Key: text("html_r2_key"),
  rawR2Key: text("raw_r2_key"),
  messageId: text("message_id"),
  dedupeKey: text("dedupe_key").unique(),
  inReplyTo: text("in_reply_to"),
  references: text("references_json", { mode: "json" }).$type<string[]>().notNull(),
  receivedAt: text("received_at"),
  sentAt: text("sent_at"),
  readAt: text("read_at"),
  starredAt: text("starred_at"),
  archivedAt: text("archived_at"),
  trashedAt: text("trashed_at"),
  hasAttachments: integer("has_attachments", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deliveredToAddressId: text("delivered_to_address_id"),
  sentFromAddressId: text("sent_from_address_id")
});

export const messageAttachments = sqliteTable(
  "message_attachments",
  {
    id: text("id").primaryKey().notNull(),
    messageId: text("message_id").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentId: text("content_id"),
    r2Key: text("r2_key").notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => [index("message_attachments_message_idx").on(table.messageId)]
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    scope: text("scope").notNull(),
    subjectHash: text("subject_hash").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull(),
    expiresAt: integer("expires_at").notNull()
  },
  (table) => [primaryKey({ columns: [table.scope, table.subjectHash, table.windowStart] })]
);

export const operationRuns = sqliteTable("operation_runs", {
  id: text("id").primaryKey().notNull(),
  kind: text("kind").notNull(),
  status: text("status", { enum: ["running", "succeeded", "failed"] }).notNull(),
  cursor: text("cursor"),
  counters: text("counters_json", { mode: "json" })
    .$type<Record<string, number>>()
    .default({})
    .notNull(),
  errorCode: text("error_code"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at")
});

export const userMailPreferences = sqliteTable(
  "user_mail_preferences",
  {
    userId: text("user_id").primaryKey().notNull(),
    defaultFromMailboxId: text("default_from_mailbox_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("user_mail_preferences_default_from_idx").on(table.defaultFromMailboxId)]
);

export const messageSenderPreferences = sqliteTable(
  "message_sender_preferences",
  {
    userId: text("user_id").notNull(),
    senderAddress: text("sender_address").notNull(),
    loadRemoteMedia: integer("load_remote_media", { mode: "boolean" }).default(false).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.senderAddress] })]
);

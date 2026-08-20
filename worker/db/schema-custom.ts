export type CustomSchemaObject = {
  name: string;
  table: string;
  type: "index" | "trigger";
};

// Drizzle Kit 0.31 cannot safely generate SQLite expression indexes or triggers. These objects
// stay in reviewed custom SQL migrations and the schema parity gate requires them by name.
export const customSchemaObjects: CustomSchemaObject[] = [
  { name: "messages_activity_idx", table: "messages", type: "index" },
  { name: "messages_mailbox_activity_idx", table: "messages", type: "index" },
  { name: "messages_folder_activity_idx", table: "messages", type: "index" },
  { name: "user_login_email_domain_insert_guard", table: "user", type: "trigger" },
  { name: "user_login_email_domain_update_guard", table: "user", type: "trigger" },
  { name: "mail_domain_login_email_insert_guard", table: "mail_domains", type: "trigger" },
  { name: "mail_domain_login_email_update_guard", table: "mail_domains", type: "trigger" },
  { name: "verification_latest_password_reset_token", table: "verification", type: "trigger" },
  { name: "message_changes_after_insert", table: "messages", type: "trigger" },
  { name: "message_changes_after_update", table: "messages", type: "trigger" },
  { name: "message_changes_after_delete", table: "messages", type: "trigger" }
];

# Changelog

## 1.0.1

- Preserve invitation password setup links so `/set-password?token=...` reaches the password form
  instead of being normalized to the inbox.

## 1.0.0

- Publish HQBase as one free and open-source shared email workspace for customer-owned Cloudflare
  infrastructure, with one signed public release and update channel.
- Support multiple email domains, shared mailboxes, aliases, catch-all delivery, drafts,
  conversations, replies, forwarding, attachments, and Gmail-compatible quoted history.
- Enforce owner, admin, member, and mailbox-level read, agent, and manager access throughout the app
  and OAuth-protected MCP endpoints.
- Provide responsive desktop, mobile, and installable PWA experiences with mailbox filtering,
  notifications, offline handling, update readiness, and device-safe layouts.
- Keep setup, domain management, updates, backup, restore, diagnostics, and resource removal inside
  the customer Cloudflare account.
- Use the verified public Cloudflare OAuth client by default and support private customer-managed
  OAuth clients with Authorization Code and PKCE, without client secrets or pasted API tokens.
- Verify signed release manifests and artifact digests before deployment, with compatibility
  checks, D1 recovery bookmarks, Worker rollback details, and staging lifecycle coverage.

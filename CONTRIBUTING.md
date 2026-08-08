# Contributing

HQBase is licensed under AGPL-3.0-only.

Submission does not guarantee acceptance. Maintainers retain sole discretion over which
contributions are merged into the official HQBase project.

Unless otherwise agreed in writing, all contributions intentionally submitted to HQBase are
licensed under AGPL-3.0-only. By submitting a contribution, you confirm that you have the legal
right to license it under these terms.

Read the public [Contributing to
HQBase](https://hqbase.io/docs/maintainers/contributing/) guide for repository ownership,
documentation changes, pull requests, optional Cloudflare testing, and the official staging and
release handoff.

For a local checkout of the main application:

```sh
pnpm install
pnpm db:migrate:local
pnpm check
pnpm deploy:dry-run
```

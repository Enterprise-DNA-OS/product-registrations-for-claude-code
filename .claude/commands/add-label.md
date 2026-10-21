---
description: "Add a label version to a registration, with its approval date if it has one."
---

# add-label

Add a label version to a registration, with its approval date if it has one.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-label "<registration>" --version=<version> --approved=<YYYY-MM-DD> --note="<what changed>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Leave out --approved if the version is not approved yet. Nothing here lodges with a regulator or pays an invoice.

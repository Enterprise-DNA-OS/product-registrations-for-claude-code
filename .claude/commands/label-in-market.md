---
description: "Record that a label version went on pack. The version it replaces is retired."
---

# label-in-market

Record that a label version went on pack. The version it replaces is retired.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs label-in-market "<registration>" --version=<version> --on=<YYYY-MM-DD> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. If the version is not approved, say so plainly. Nothing here lodges with a regulator or pays an invoice.

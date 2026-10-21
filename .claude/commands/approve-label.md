---
description: "Record that a label version was approved."
---

# approve-label

Record that a label version was approved.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs approve-label "<registration>" --version=<version> --on=<YYYY-MM-DD> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Use the date on the regulator's approval. Nothing here lodges with a regulator or pays an invoice.

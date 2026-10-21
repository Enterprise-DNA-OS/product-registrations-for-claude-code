---
description: "Record that an application was granted, with the end date the regulator set."
---

# grant

Record that an application was granted, with the end date the regulator set.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs grant "<registration>" --on=<YYYY-MM-DD> --expires=<YYYY-MM-DD> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. APVMA registrations end on a 30 June. Take the dates from the approval. Nothing here lodges with a regulator or pays an invoice.

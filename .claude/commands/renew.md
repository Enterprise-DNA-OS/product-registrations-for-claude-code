---
description: "Record a renewal that has been lodged and paid. The end date moves on one or five years."
---

# renew

Record a renewal that has been lodged and paid. The end date moves on one or five years.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs renew "<registration>" --on=<YYYY-MM-DD> --years=<1|5> --receipt=<receipt> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. An APVMA product past 30 June cannot be renewed: it needs a new application. Nothing here lodges with a regulator or pays an invoice.

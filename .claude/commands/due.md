---
description: "Everything due in the next N days (default 30), with the rule behind each date."
---

# due

Everything due in the next N days (default 30), with the rule behind each date.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs due --days=<days> --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Soonest first. Include the rule text for anything late. Nothing here lodges with a regulator or pays an invoice.

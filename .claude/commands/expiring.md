---
description: "Registrations whose paid-up period or certificate ends in the next twelve months."
---

# expiring

Registrations whose paid-up period or certificate ends in the next twelve months.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs expiring --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Anything with negative days has already ended. Nothing here lodges with a regulator or pays an invoice.

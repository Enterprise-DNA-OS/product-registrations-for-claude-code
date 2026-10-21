---
description: "Record that a regulator invoice was paid."
---

# pay-fee

Record that a regulator invoice was paid.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs pay-fee <FEE-code> --on=<YYYY-MM-DD> --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Only once the payment has gone. Nothing here lodges with a regulator or pays an invoice.

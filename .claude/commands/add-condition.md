---
description: "Record a condition written on a registration or certificate."
---

# add-condition

Record a condition written on a registration or certificate.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-condition "<registration>" --number=<n> --text="<the condition as written>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Copy the wording from the certificate. If the condition carries a date, add an obligation for it. Nothing here lodges with a regulator or pays an invoice.

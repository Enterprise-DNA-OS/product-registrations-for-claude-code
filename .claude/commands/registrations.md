---
description: "The register: every registration with its regulator, market, status, product and holder."
---

# registrations

The register: every registration with its regulator, market, status, product and holder.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs registrations --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Group by regulator. Nothing here lodges with a regulator or pays an invoice.

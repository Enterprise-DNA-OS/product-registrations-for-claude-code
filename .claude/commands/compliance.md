---
description: "Check the register against the APVMA, TGA and AICIS dates, labels on pack, invoices and conditions, with the rule cited."
---

# compliance

Check the register against the APVMA, TGA and AICIS dates, labels on pack, invoices and conditions, with the rule cited.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs compliance --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Breaches first, then warnings. For each, say the fix: what to lodge, renew, notify or pay, and by when. The rules and their sources are in docs/compliance.md and the rules table; if one looks out of date, say so and stop. This is a records check, not regulatory advice. Nothing here lodges with a regulator or pays an invoice.

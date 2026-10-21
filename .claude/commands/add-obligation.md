---
description: "Add a dated obligation: a condition's report, a stability study, a commitment made to a regulator."
---

# add-obligation

Add a dated obligation: a condition's report, a stability study, a commitment made to a regulator.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-obligation --title="<what>" --registration="<registration>" --due=<YYYY-MM-DD> --owner="<name>" --note="<note>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Say the code it was given and when it falls due. Nothing here lodges with a regulator or pays an invoice.

---
description: "Add a holder: the TGA sponsor, APVMA registrant, AICIS introducer or overseas licence holder."
---

# add-holder

Add a holder: the TGA sponsor, APVMA registrant, AICIS introducer or overseas licence holder.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-holder --code=<CODE> --name="<legal name>" --abn="<ABN>" --role="<role>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Use the legal name as it appears on the regulator's register. Nothing here lodges with a regulator or pays an invoice.

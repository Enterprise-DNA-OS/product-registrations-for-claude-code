---
description: "Add a product to the register."
---

# add-product

Add a product to the register.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs add-product --code=<CODE> --name="<name>" --brand="<brand>" --category="<category>" --manager="<name>" --actor="<name>" --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Then add a registration for each market it is sold in. Nothing here lodges with a regulator or pays an invoice.

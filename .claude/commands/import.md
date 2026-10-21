---
description: "Bring registrations across from a Veeva Vault RIM report or a spreadsheet, or sales from the accounts, saved as CSV."
---

# import

Bring registrations across from a Veeva Vault RIM report or a spreadsheet, or sales from the accounts, saved as CSV.

Read fresh data. Never invent a registration, a date, an amount or command output.

```bash
node scripts/registrations.mjs import <registrations|sales> <file.csv> --map=<headings.json> --holder=<default holder> --regulator=<default regulator> --dry-run --json
```

Replace angle-bracket placeholders with what the person told you; leave out optional flags they did not ask for. If a registration or product is ambiguous, list the candidates and ask. Always run with --dry-run first and report the counts. Then run without it. Guide: docs/replace-veeva-vault-rim.md. Nothing here lodges with a regulator or pays an invoice.

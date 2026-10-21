# CLI reference

`node scripts/registrations.mjs <command> [arguments] [--key=value] [--json]`

Human tables by default, `--json` for machines. Registration numbers match with or without spaces and in any case (`aust l400101` is `AUST L 400101`), then by prefix, suffix or part of the product or holder name; codes match products, holders, submissions, fees and obligations the same way. More than one match lists the candidates and exits 1. Unknown flags fail before anything is written. Dates are `YYYY-MM-DD` (imports also accept `DD/MM/YYYY`). Amounts are dollars. `--actor=<name>` labels any write in the activity log.

## Reads

| Command | Returns |
|---|---|
| `attention` | Everything that needs a person, worst first |
| `calendar` | Every open date in the next twelve months |
| `due [--days=30]` | Open dates due within N days, with the rule |
| `compliance` | Rule findings with the rule cited (docs/compliance.md) |
| `registrations` | The register |
| `registration <number>` | One registration: dates, submissions, labels, conditions, sales, declarations, renewals, fees, obligations, history |
| `product <code>` | One product in every market |
| `products` | Products with current registrations and markets |
| `holders` | Holders with current registration counts |
| `regulators` | Regulators, country and how their registrations renew |
| `applications` | Submissions waiting for a decision |
| `submissions` | Every submission, outcome and days taken |
| `renewals` | APVMA, AICIS and certificate renewals in the next 120 days |
| `declarations` | Levy, annual return, $0 turnover and AICIS declarations for the latest periods |
| `ace` | TGA entries on the annual charge exemption and their state |
| `sales` | Sales by registration for the last financial year |
| `fees` | Unpaid regulator invoices |
| `labels` | Every label version and its state |
| `expiring` | Registrations ending in the next twelve months |
| `obligations` | Open obligations |
| `insights` | The ten questions |
| `rules` | The rules with their sources |
| `activity` | The last 50 changes |

## Writes

| Command | Does |
|---|---|
| `add-holder --code --name [--abn] [--role]` | Adds a holder |
| `add-product --code --name [--brand] [--category] [--manager]` | Adds a product |
| `add-registration --ref --regulator --holder [--product] [--kind] [--status] [--applied] [--granted] [--expires] [--ace] [--level] [--manager] [--note]` | Adds a registration or application. APVMA ends on 30 June, AICIS on 31 August. |
| `grant <number> --on [--expires]` | An application granted; closes its pending new submission |
| `lodge <number> --kind --title --on [--regulator-ref] [--owner]` | Records a lodged submission |
| `decide <SUB> --outcome --on` | Records the decision. A refused or withdrawn new application ends the registration. |
| `renew <number> --on [--years=1\|5] [--receipt]` | Records a renewal and moves the end date. Refused for an APVMA product past 30 June. |
| `declare <number> --kind=levy\|return\|ace\|turnover\|aicis --on [--period] [--value] [--receipt]` | Records a declaration. `ace` is refused for an entry that sold; `turnover` ends the exemption. |
| `record-sales <number> --fy --value [--quantity] [--unit] [--currency]` | Records or corrects a year's sales |
| `add-fee <number> --kind --amount --due [--period] [--invoice] [--currency] [--note]` | Records a regulator invoice |
| `pay-fee <FEE> --on` | Marks it paid |
| `add-label <number> --version [--approved] [--note]` | Adds a label version |
| `approve-label <number> --version --on` | Records an approval |
| `label-in-market <number> --version --on` | Puts a version on pack and retires the one before |
| `add-condition <number> --number --text` | Records a condition |
| `add-obligation --title --due [--registration] [--owner] [--note]` | Adds a dated obligation |
| `done <OB> [--on]` | Marks it done |
| `end <number> --status=cancelled\|lapsed\|withdrawn --on [--reason]` | Ends a registration, keeping its history |
| `import registrations\|sales <file.csv> [--map] [--holder] [--regulator] [--dry-run]` | All-or-nothing CSV import (docs/replace-veeva-vault-rim.md) |
| `export [--file]` | Every table to one JSON file |

## Drafts

Each writes a new Markdown file to `drafts/` and never overwrites one.

| Command | Drafts |
|---|---|
| `weekly-review` | The Monday review from attention, due and compliance |
| `draft-renewals` | Renewals due in the next 120 days, with fees on file |
| `draft-levy` | The APVMA levy and annual return working paper for the last financial year |
| `draft-ace` | The TGA list: declare $0, notify turnover, already declared |
| `draft-aicis` | The AICIS annual declaration working paper |
| `draft-submission <SUB>` | The record behind a submission |

`npm run view` renders `views.json` to `views/`. `npm run docs` renders `documents.json` to `docs-out/`. Both read only.

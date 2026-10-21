# Why there is no front end

Veeva Vault RIM is a database with a subscription. A registration register underneath it is ordinary: products, markets, numbers, dates, labels, invoices and the sales behind each declaration. What you pay for is the layer on top that lets people who do not write SQL get at those records. Screens, filters, dashboards, forms.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, describe what you want, and it writes the query, runs it, and explains the answer. Ask a question the dashboard never had a chart for and you still get an answer.

## What you gain

- **Better answers.** A dashboard shows what the vendor decided to chart. Here you ask "which exempt entries started selling" or "what did we pay the APVMA this year" in your own words and get it answered against your own data.
- **No seats.** Regulatory, quality, marketing and the managing director can all look. The bill does not grow with headcount.
- **Your data in your Postgres.** Plain tables. Back them up, query them from anything, leave any time. There is no export step because there is nothing to leave.
- **Rules you can read.** Every date comes from a row in the rules table with its source. When a regulator changes its process, you change the row.

## What you give up

- **Document management.** Dossiers, artwork and publishing stay in your document system. The register holds the facts about them.
- **A visual workflow.** Submissions are rows you ask about, not cards you drag.
- **A phone app.** It runs where Claude Code runs.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for businesses that want someone to call.

## Who this fits

Makers and importers with a small regulatory team, a few dozen to a few hundred registrations, and more dates than people. If your company files hundreds of dossiers a year across forty markets, keep a full suite. If you need the dates, the declarations and the answers more than the screens, this is cheaper, faster and yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/veeva-vault-rim

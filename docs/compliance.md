# The rules this register checks

`/compliance` (and `node scripts/registrations.mjs compliance`) checks the records against the rules below. Each finding names its rule. The rules are rows in the `rules` table and the dates are worked out in the `reg_calendar` view, so a change in a regulator's process is one migration through `/customise`, not a code change.

This is a records check. It is not regulatory advice, and it does not decide whether a product needs a registration, a variation or a new application. The holder and its regulatory adviser decide that. Confirm every rule against the source before you rely on it, and again whenever the regulator's guidance changes.

A date is a **warning** when it falls inside the next 30 days and a **breach** once it has passed with nothing recorded. All sources checked 2026-10-21.

## APVMA: agricultural and veterinary chemical products

| Check | The rule | What the register flags |
|---|---|---|
| `APVMA-RENEWAL` | The holder applies to renew each financial year, no later than one month before the registration ends on 30 June. After 30 May, a late renewal needs a written request the APVMA agrees to and a late renewal fee per product, and must be made before 30 June. A product not renewed by 30 June is de-registered and needs a new application to be registered again. Renewal can be paid one year or five years ahead. Source: https://www.apvma.gov.au/registrations-and-permits/chemical-product-registration/renew-registration | A current registration ending inside 120 days with no renewal recorded (due one month before the end date). Once the end date passes with no renewal, a breach that says the product is de-registered. A renewal recorded after the one month cut-off is a warning even once it is in. |
| `APVMA-LEVY` | The holder declares the value of sales of each registered product for the financial year, excluding GST and generally excluding export sales. The APVMA sends the request in September and declarations are due by 31 October. The levy is payable by 15 January. Source: https://www.apvma.gov.au/registrations-and-permits/chemical-product-registration/after-registration/levies/notice-levy-calculation | No leviable value recorded for the last financial year, for every APVMA registration in force during it. `/draft-levy` builds the working paper from the year's sales. |
| `APVMA-RETURN` | The annual return of the quantity of each registered product goes in before 30 November. Online reporting opens on 1 July. Not lodging is an offence and can bring a civil penalty. Source: https://www.apvma.gov.au/node/18326 | No annual return recorded for the last financial year (due 29 November, the last day before 30 November). |

## TGA: the annual charge exemption

| Check | The rule | What the register flags |
|---|---|---|
| `TGA-ACE` | An ARTG entry on the annual charge exemption pays no annual charge until it starts generating turnover. To stay exempt the sponsor declares $0 turnover in TGA Business Services between 1 and 22 July each year. A late declaration with a fee is possible between 23 July and 15 September, a date set in legislation that cannot be extended. With no declaration the TGA treats turnover as started, and annual charges apply every year until the entry is cancelled. Source: https://www.tga.gov.au/how-we-regulate/fees-and-payments/annual-charges/annual-charge-exemption-scheme-ace/annual-charge-exemption-scheme | An exempt entry with no sales recorded for the last financial year and no $0 declaration recorded (due 22 July). |
| `TGA-TURNOVER` | When an exempt entry starts generating turnover the sponsor notifies the TGA, the exemption ends, and the annual charge is payable that year and every year after until the entry is cancelled. Same source. | An exempt entry with sales recorded for the last financial year and no notification of turnover recorded. The CLI refuses a $0 declaration for it. |

## AICIS: industrial chemicals (cosmetics, soaps, paints)

| Check | The rule | What the register flags |
|---|---|---|
| `AICIS-RENEWAL` | The registration year runs from 1 September to 31 August. A business that keeps importing or manufacturing industrial chemicals renews by 31 August, reporting the value introduced in the last financial year. Introducing without an active registration is an offence under the Industrial Chemicals Act 2019. Source: https://www.industrialchemicals.gov.au/business/getting-started-registration-importing-and-manufacturing/what-registration-and-who-must-register | The business registration ending inside 120 days with no renewal recorded. A renewal recorded after 31 August is a warning. |
| `AICIS-DECL` | After each registration year ends, every registered introducer submits an annual declaration by 30 November. An agent cannot submit it for the business. Records behind registration and introductions are kept for at least 5 years. Source: https://www.industrialchemicals.gov.au/business/reporting-and-record-keeping-obligations/annual-declaration-all-introducers | No annual declaration recorded for the registration year that ended on the last 31 August. |

## Every market

| Check | The rule | What the register flags |
|---|---|---|
| `EXPIRY` | The expiry date on a registration certificate, for any regulator set up with `renewal = 'date'` (in the demo, Malaysia's NPRA). Lodge the renewal before it, allowing for that regulator's own lead time. Source: your certificate. | A current registration whose certificate expires inside twelve months, due the day before it expires. |
| `FEE` | The due date on a regulator's invoice. TGA annual charge invoices are usually due by 15 September; the APVMA levy by 15 January. Source: the invoice, and the TGA and APVMA pages above. | An invoice with no payment recorded. |
| `LABEL` | The label on pack should be the version approved for the registration. The register records which version is approved and which is on pack. Source: your registration and approved label. | A version on pack with no approval date recorded. |
| `OBLIGATION` | The date in a condition of registration or a commitment you made to a regulator. Source: the condition. | An open obligation inside 30 days or past its date. |

## Adding a market or a rule

New Zealand's ACVM registrations sit in the register already with their conditions and obligations, but no date rules: add them with `/customise` when you have confirmed them with MPI. Another regulator is a row in `regulators` plus its rules in `rules` and the matching branch of the `reg_calendar` view. `/customise` writes the migration and the test.

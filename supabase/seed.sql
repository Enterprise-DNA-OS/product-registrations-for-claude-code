-- Demo data: Southern Cross Botanicals, a fictional Australian and New Zealand group that sponsors complementary
-- medicines on the ARTG, holds agvet registrations with the APVMA, imports cosmetics under an AICIS
-- business registration, and sells into New Zealand and Malaysia.
-- Every date is relative to today, so the demo always has something late and something due.
-- Deliberately wrong: a $0 turnover declaration missed, an exempt entry that sold, an APVMA product not renewed,
-- a TGA annual charge invoice unpaid, a label on pack that is not the approved one, a submission waiting
-- 140 days, an AICIS renewal lodged after 31 August and a condition's report overdue.
-- Idempotent: running it twice changes nothing. Never load it into your real register.

do $$
declare
  fy date := last_fy_end(current_date);
  ay date := aicis_year_end(current_date);
  scb uuid; sca uuid; knz uuid;
begin
  if exists (select 1 from holders where code = 'SCB') then return; end if;

  insert into holders (code, name, abn, role) values
    ('SCB', 'Southern Cross Botanicals Pty Ltd', '11 222 333 444', 'TGA sponsor and AICIS introducer') returning id into scb;
  insert into holders (code, name, abn, role) values
    ('SCA', 'Southern Cross Agri Pty Ltd', '55 666 777 888', 'APVMA registrant') returning id into sca;
  insert into holders (code, name, abn, role) values
    ('KNZ', 'Kowhai Naturals Ltd', null, 'New Zealand registrant') returning id into knz;

  insert into products (code, name, brand, category, manager, status) values
    ('MAG-N', 'Magnesium Night Powder', 'Southern Cross', 'complementary medicine', 'Priya Nair', 'active'),
    ('LIV-C', 'Liver Support Capsules', 'Southern Cross', 'complementary medicine', 'Priya Nair', 'active'),
    ('JNT-C', 'Joint Ease Cream', 'Southern Cross', 'complementary medicine', 'Priya Nair', 'active'),
    ('KID-D', 'Kids Immune Drops', 'Little Cross', 'complementary medicine', 'Tom Walsh', 'active'),
    ('BLT-G', 'Bloat Guard for Cattle', 'SC Agri', 'veterinary chemical', 'Hemi Parata', 'active'),
    ('RYE-5', 'Ryegrass Herbicide 500', 'SC Agri', 'herbicide', 'Hemi Parata', 'active'),
    ('FLY-S', 'Fly Strike Spray', 'SC Agri', 'veterinary chemical', 'Hemi Parata', 'active'),
    ('CU-40', 'Copper Fungicide 400', 'SC Agri', 'fungicide', 'Hemi Parata', 'active'),
    ('ECH-T', 'Echinacea Tablets', 'Southern Cross', 'complementary medicine', 'Priya Nair', 'discontinued'),
    ('HND-B', 'Hand Balm', 'Southern Cross', 'cosmetic', 'Tom Walsh', 'active');

  insert into registrations (ref, regulator, holder_id, product_id, kind, status, applied_on, granted_on, expires_on, ended_on, ace, level, manager, note) values
    ('AUST L 400101', 'TGA', scb, (select id from products where code = 'MAG-N'), 'listed medicine', 'current', date '2019-02-11', date '2019-03-04', null, null, false, null, 'Priya Nair', null),
    ('AUST L 400102', 'TGA', scb, (select id from products where code = 'LIV-C'), 'listed medicine', 'current', fy - 230, fy - 200, null, null, true, null, 'Priya Nair', 'Listed ahead of launch; no sales yet.'),
    ('AUST L 400103', 'TGA', scb, (select id from products where code = 'JNT-C'), 'listed medicine', 'current', date '2021-07-19', date '2021-08-02', null, null, false, null, 'Priya Nair', null),
    ('AUST L 400104', 'TGA', scb, (select id from products where code = 'KID-D'), 'listed medicine', 'current', fy - 560, fy - 540, null, null, true, null, 'Tom Walsh', 'Launched in pharmacy this year.'),
    ('AUST L 398870', 'TGA', scb, (select id from products where code = 'ECH-T'), 'listed medicine', 'cancelled', date '2016-05-02', date '2016-05-20', null, fy - 120, false, null, 'Priya Nair', 'Cancelled when the product was discontinued.'),
    ('APVMA 88101', 'APVMA', sca, (select id from products where code = 'BLT-G'), 'agvet product', 'current', date '2018-01-15', date '2018-06-04', (fy + interval '1 year')::date, null, false, null, 'Hemi Parata', null),
    ('APVMA 88102', 'APVMA', sca, (select id from products where code = 'RYE-5'), 'agvet product', 'current', date '2020-02-03', date '2020-09-14', (fy + interval '1 year')::date, null, false, null, 'Hemi Parata', null),
    ('APVMA 88103', 'APVMA', sca, (select id from products where code = 'FLY-S'), 'agvet product', 'current', date '2017-03-20', date '2017-11-06', fy, null, false, null, 'Hemi Parata', 'Renewal reminder went to a former employee.'),
    ('APVMA 88104', 'APVMA', sca, (select id from products where code = 'CU-40'), 'agvet product', 'application', current_date - 140, null, null, null, false, null, 'Hemi Parata', null),
    ('AICIS 2020-0457', 'AICIS', scb, null, 'industrial chemicals introducer', 'current', date '2020-08-10', date '2020-09-01', (ay + interval '1 year')::date, null, false, 2, 'Tom Walsh', 'Covers the cosmetics range, including Hand Balm.'),
    ('ACVM A012345', 'ACVM', knz, (select id from products where code = 'BLT-G'), 'agvet product', 'current', date '2021-04-12', date '2021-10-01', null, null, false, null, 'Hemi Parata', null);

  insert into regulators (code, name, country, renewal, website) values
    ('NPRA', 'National Pharmaceutical Regulatory Agency', 'MY', 'date', 'https://www.npra.gov.my')
  on conflict (code) do nothing;
  insert into registrations (ref, regulator, holder_id, product_id, kind, status, applied_on, granted_on, expires_on, manager, note) values
    ('MAL21046012N', 'NPRA', scb, (select id from products where code = 'MAG-N'), 'product', 'current', date '2021-01-18', (current_date + 75 - interval '5 years')::date, current_date + 75, 'Priya Nair', 'Held through the Kuala Lumpur distributor.');

  insert into conditions (registration_id, number, text) values
    ((select id from registrations where ref = 'ACVM A012345'), '3', 'Provide the results of the 24 month stability study by the date agreed in the registration.'),
    ((select id from registrations where ref = 'APVMA 88102'), '1', 'Supply only with the approved label.'),
    ((select id from registrations where ref = 'AUST L 400104'), '1', 'Keep the evidence held for each indication on file and available to the TGA.');

  insert into obligations (code, title, registration_id, due_on, owner, done_on, note) values
    ('OB-001', 'Send the 24 month stability results (condition 3)', (select id from registrations where ref = 'ACVM A012345'), current_date - 12, 'Hemi Parata', null, null),
    ('OB-002', 'Review the evidence file for each Kids Immune Drops indication', (select id from registrations where ref = 'AUST L 400104'), current_date + 20, 'Tom Walsh', null, 'Annual internal review.'),
    ('OB-003', 'Update the Malaysian distributor agreement before renewal', (select id from registrations where ref = 'MAL21046012N'), current_date + 45, 'Priya Nair', null, null),
    ('OB-004', 'Send the 12 month stability results', (select id from registrations where ref = 'ACVM A012345'), current_date - 400, 'Hemi Parata', current_date - 405, null);

  insert into submissions (code, registration_id, kind, title, lodged_on, regulator_ref, outcome, decided_on, owner) values
    ('SUB-001', (select id from registrations where ref = 'APVMA 88104'), 'new', 'Registration of Copper Fungicide 400', current_date - 140, 'APP-145502', 'pending', null, 'Hemi Parata'),
    ('SUB-002', (select id from registrations where ref = 'AUST L 400103'), 'variation', 'Add a 100 g tube', current_date - 410, 'VAR-30881', 'approved', current_date - 380, 'Priya Nair'),
    ('SUB-003', (select id from registrations where ref = 'APVMA 88102'), 'variation', 'Label change: new pack size and re-entry period wording', current_date - 34, 'VAR-77120', 'pending', null, 'Hemi Parata'),
    ('SUB-004', (select id from registrations where ref = 'AUST L 400101'), 'notification', 'Change of manufacturer site', current_date - 220, 'NOT-11920', 'approved', current_date - 205, 'Priya Nair'),
    ('SUB-005', (select id from registrations where ref = 'APVMA 88101'), 'variation', 'Extend shelf life to 36 months', current_date - 300, 'VAR-70415', 'approved', current_date - 160, 'Hemi Parata'),
    ('SUB-006', (select id from registrations where ref = 'ACVM A012345'), 'variation', 'Add a 20 L drum', current_date - 260, 'ACVM-V-3381', 'refused', current_date - 150, 'Hemi Parata');

  insert into labels (registration_id, version, approved_on, in_market_on, retired_on, note) values
    ((select id from registrations where ref = 'APVMA 88101'), '2', current_date - 160, current_date - 120, null, '36 month shelf life'),
    ((select id from registrations where ref = 'APVMA 88101'), '1', date '2018-06-04', date '2018-07-01', current_date - 120, null),
    ((select id from registrations where ref = 'APVMA 88102'), '3', date '2022-03-01', date '2022-04-01', current_date - 21, null),
    ((select id from registrations where ref = 'APVMA 88102'), '4', null, current_date - 21, null, 'Printed before the label variation was decided.'),
    ((select id from registrations where ref = 'AUST L 400101'), 'B', current_date - 205, current_date - 190, null, null);

  insert into renewals (registration_id, period_ending, lodged_on, years, late, receipt) values
    ((select id from registrations where ref = 'APVMA 88101'), fy, fy - 50, 1, false, 'RCPT-50211'),
    ((select id from registrations where ref = 'APVMA 88102'), fy, fy - 44, 1, false, 'RCPT-50212'),
    ((select id from registrations where ref = 'APVMA 88103'), (fy - interval '1 year')::date, (fy - interval '1 year')::date - 41, 1, false, 'RCPT-48810'),
    ((select id from registrations where ref = 'AICIS 2020-0457'), ay, ay + 5, 1, true, 'AICIS-R-2291');

  insert into sales (registration_id, fy_ending, value_cents, quantity, unit) values
    ((select id from registrations where ref = 'AUST L 400101'), fy, 61240000, 41200, 'tubs'),
    ((select id from registrations where ref = 'AUST L 400101'), (fy - interval '1 year')::date, 54810000, 37650, 'tubs'),
    ((select id from registrations where ref = 'AUST L 400103'), fy, 18975000, 22300, 'tubes'),
    ((select id from registrations where ref = 'AUST L 400103'), (fy - interval '1 year')::date, 21420000, 25100, 'tubes'),
    ((select id from registrations where ref = 'AUST L 400104'), fy, 1840000, 1380, 'bottles'),
    ((select id from registrations where ref = 'APVMA 88101'), fy, 42660000, 9480, 'L'),
    ((select id from registrations where ref = 'APVMA 88101'), (fy - interval '1 year')::date, 39120000, 8690, 'L'),
    ((select id from registrations where ref = 'APVMA 88102'), fy, 128400000, 53500, 'L'),
    ((select id from registrations where ref = 'APVMA 88102'), (fy - interval '1 year')::date, 117300000, 48900, 'L'),
    ((select id from registrations where ref = 'APVMA 88103'), fy, 0, 0, 'L'),
    ((select id from registrations where ref = 'APVMA 88103'), (fy - interval '1 year')::date, 2210000, 610, 'L'),
    ((select id from registrations where ref = 'AICIS 2020-0457'), fy, 9420000, null, null),
    ((select id from registrations where ref = 'ACVM A012345'), fy, 11550000, 2400, 'L');
  update sales set currency = 'NZD' where registration_id = (select id from registrations where ref = 'ACVM A012345');

  insert into declarations (registration_id, kind, period_ending, lodged_on, value_cents, receipt) values
    ((select id from registrations where ref = 'APVMA 88102'), 'APVMA-LEVY', fy, current_date - 9, 128400000, 'LEVY-2210'),
    ((select id from registrations where ref = 'APVMA 88101'), 'APVMA-LEVY', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 115, 39120000, 'LEVY-1984'),
    ((select id from registrations where ref = 'APVMA 88102'), 'APVMA-LEVY', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 115, 117300000, 'LEVY-1985'),
    ((select id from registrations where ref = 'APVMA 88103'), 'APVMA-LEVY', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 115, 2210000, 'LEVY-1986'),
    ((select id from registrations where ref = 'APVMA 88101'), 'APVMA-RETURN', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 140, null, 'RET-0931'),
    ((select id from registrations where ref = 'APVMA 88102'), 'APVMA-RETURN', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 140, null, 'RET-0932'),
    ((select id from registrations where ref = 'APVMA 88103'), 'APVMA-RETURN', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 140, null, 'RET-0933'),
    ((select id from registrations where ref = 'AUST L 400104'), 'TGA-ACE', (fy - interval '1 year')::date, (fy - interval '1 year')::date + 9, 0, 'ACE-7731'),
    ((select id from registrations where ref = 'AICIS 2020-0457'), 'AICIS-DECL', (ay - interval '1 year')::date, (ay - interval '1 year')::date + 71, null, 'AD-4410');

  insert into fees (code, registration_id, kind, period, amount_cents, currency, due_on, paid_on, invoice, note) values
    ('FEE-001', (select id from registrations where ref = 'AUST L 400101'), 'annual charge', to_char(fy, 'YYYY') || '-' || to_char(fy + 365, 'YY'), 115000, 'AUD', least(fy + 77, current_date - 36), null, 'TGA-INV-883012', 'Annual charge for the ARTG entry. Amount as invoiced.'),
    ('FEE-002', (select id from registrations where ref = 'AUST L 400103'), 'annual charge', to_char(fy, 'YYYY') || '-' || to_char(fy + 365, 'YY'), 115000, 'AUD', least(fy + 77, current_date - 36), least(fy + 60, current_date - 50), 'TGA-INV-883013', null),
    ('FEE-003', (select id from registrations where ref = 'APVMA 88102'), 'levy', 'year ending ' || (fy - interval '1 year')::date, 1173000, 'AUD', make_date(extract(year from fy)::int, 1, 15), make_date(extract(year from fy)::int, 1, 9), 'APVMA-LV-6610', 'Amount as assessed.'),
    ('FEE-004', (select id from registrations where ref = 'APVMA 88101'), 'renewal fee', 'year from ' || (fy + 1), 50000, 'AUD', fy - 31, fy - 50, 'APVMA-RN-50211', 'Amount as invoiced.'),
    ('FEE-005', (select id from registrations where ref = 'APVMA 88104'), 'application fee', null, 1460000, 'AUD', current_date - 150, current_date - 141, 'APVMA-AP-145502', 'Amount as invoiced.'),
    ('FEE-006', (select id from registrations where ref = 'MAL21046012N'), 'renewal fee', 'five years', 120000, 'MYR', current_date + 40, null, 'NPRA-Q-2210', 'Quoted by the distributor.');

  insert into activity (entity_id, action, actor, detail) values ('seed', 'seed', 'demo', '{"note":"Southern Cross Botanicals demo register"}');
end $$;

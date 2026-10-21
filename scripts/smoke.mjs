#!/usr/bin/env node
// npm test: a temporary database, the migration, the seed twice, every CLI command, the rules and both imports.
// The demo dates move with today, so every check here holds on any day of the year.
// Set TEST_DATABASE_URL to run the same checks against an empty disposable Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, COMMANDS, READS, TABLES, QUESTIONS, cents, isoDate, normaliseRef, fyEnding, today } from './lib/registrations.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'registrations-test-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.OUTPUT_DIR = dir;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';

const db = await getDb();
const covered = new Set();
let checks = 0;
const call = (c, a = [], o = {}) => { covered.add(c); return run(db, c, a, o); };
async function fails(c, a, o, re) { await assert.rejects(() => call(c, a, o), re); checks++; }
function child(script, args = [], status = 0) {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(p.status, status, p.stderr || p.stdout);
  checks++;
  return p.stdout;
}
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const A = { actor: 'Tester' };
const read = (f) => fs.readFileSync(f, 'utf8');
const d10 = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

try {
  // Migration runs once; the seed is idempotent.
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0);
  const seed = read(path.join(REPO_ROOT, 'supabase', 'seed.sql'));
  await db.exec(seed);
  await db.exec(seed);
  assert.equal((await db.query('select * from registrations')).length, 12);
  assert.equal((await db.query('select * from sales')).length, 13);
  assert.equal((await db.query('select * from submissions')).length, 6);
  const [{ fy, ay }] = await db.query('select last_fy_end(current_date)::text as fy, aicis_year_end(current_date)::text as ay');
  assert.ok(fy.endsWith('-06-30') && fy < today() && fy >= day(366), 'last_fy_end is the last 30 June before today');
  assert.ok(ay.endsWith('-08-31') && ay < today() && ay >= day(366), 'aicis_year_end is the last 31 August before today');

  // The date arithmetic behind every rule.
  const f = async (sql) => (await db.query(`select (${sql})::text as v`))[0].v;
  assert.equal(await f("last_fy_end(date '2026-10-21')"), '2026-06-30');
  assert.equal(await f("last_fy_end(date '2026-06-30')"), '2025-06-30');
  assert.equal(await f("last_fy_end(date '2026-07-01')"), '2026-06-30');
  assert.equal(await f("last_fy_end(date '2026-01-15')"), '2025-06-30');
  assert.equal(await f("aicis_year_end(date '2026-09-01')"), '2026-08-31');
  assert.equal(await f("aicis_year_end(date '2026-08-31')"), '2025-08-31');
  assert.equal(fyEnding('2026-07-01'), '2027-06-30');
  assert.equal(fyEnding('2026-06-30'), '2026-06-30');
  assert.equal(normaliseRef('aust l400101'), 'AUST L 400101');
  assert.equal(normaliseRef('  APVMA   88101 '), 'APVMA 88101');
  assert.throws(() => normaliseRef(''), /Not a registration/);
  assert.throws(() => normaliseRef('AUST L 4001; drop'), /Not a registration/);
  assert.equal(cents('1,150.50'), 115050);
  assert.throws(() => cents('12.345'), /dollar/);
  assert.equal(isoDate('03/02/2026'), '2026-02-03');
  assert.throws(() => isoDate('2026-02-30'), /Invalid/);

  // Every read returns rows in the shape the commands promise.
  for (const c of Object.keys(READS)) assert.ok(Array.isArray(await call(c)), c);
  assert.equal(QUESTIONS.length, 10);
  assert.equal((await call('insights')).length, 10);
  const attention = await call('attention');
  const has = (item, ref) => attention.some((r) => r.item.endsWith(item) && r.ref === ref);
  for (const [item, ref] of [['APVMA renewal', 'APVMA 88103'], ['regulator invoice', 'AUST L 400101'], ['obligation', 'ACVM A012345'],
    ['turnover on an exempt entry', 'AUST L 400104'], ['label not approved', 'APVMA 88102'], ['submission still waiting', 'APVMA 88104']])
    assert.ok(has(item, ref), `attention has ${item} on ${ref}`);
  assert.ok(attention.filter((r) => r.ref === 'APVMA 88103' && r.item === 'late: APVMA renewal').length === 1, 'a registration past 30 June with no renewal is late');
  assert.ok(!attention.some((r) => r.ref === 'AUST L 398870'), 'a cancelled entry carries no dates');
  assert.ok(!attention.some((r) => r.ref === 'APVMA 88102' && /levy/.test(r.item)), 'a declared leviable value clears the item');
  const findings = await call('compliance');
  const rules = new Set(findings.map((r) => r.rule));
  for (const r of ['APVMA-RENEWAL', 'TGA-TURNOVER', 'LABEL', 'FEE', 'OBLIGATION', 'AICIS-RENEWAL']) assert.ok(rules.has(r), `compliance has ${r}`);
  assert.ok(findings.some((r) => r.rule === 'APVMA-RENEWAL' && r.ref === 'APVMA 88103' && /de-registered/.test(r.finding)));
  assert.ok(findings.some((r) => r.rule === 'AICIS-RENEWAL' && r.severity === 'warning' && /lodged .* after/.test(r.finding)), 'an AICIS renewal after 31 August is a finding');
  assert.ok(findings.filter((r) => r.severity === 'breach').every((r) => /late|de-registered|sold/.test(r.finding)));
  const calendar = await db.query('select * from reg_calendar');
  assert.ok(calendar.some((r) => r.kind === 'TGA-ACE' && r.ref === 'AUST L 400102' && d10(r.due_on) === isoDate(addDays(fy, 22))), 'the $0 turnover declaration is due 22 July');
  assert.ok(!calendar.some((r) => r.kind === 'TGA-ACE' && r.ref === 'AUST L 400104'), 'an exempt entry that sold is not asked for a $0 declaration');
  assert.ok(calendar.some((r) => r.kind === 'APVMA-LEVY' && d10(r.due_on) === `${fy.slice(0, 4)}-10-31`));
  assert.ok(calendar.some((r) => r.kind === 'APVMA-RETURN' && d10(r.due_on) === `${fy.slice(0, 4)}-11-29`), 'the annual return goes in before 30 November');
  assert.ok(calendar.some((r) => r.kind === 'AICIS-DECL' && d10(r.due_on) === `${ay.slice(0, 4)}-11-30` && !r.done_on));
  assert.ok(calendar.some((r) => r.kind === 'APVMA-RENEWAL' && r.ref === 'APVMA 88103' && d10(r.due_on) === `${fy.slice(0, 4)}-05-30`), 'APVMA renewal is due one month before 30 June');
  assert.ok((await call('due', [], { days: '30' })).every((r) => r.days_left <= 30));
  await fails('due', [], { days: 'soon' }, /--days/);
  assert.equal((await call('applications')).length, 2);
  assert.ok((await call('ace')).some((r) => r.ref === 'AUST L 400104' && r.state.startsWith('sold')));

  // A new agvet product from application to grant, label, renewal, sales and declarations.
  await call('add-holder', [], { ...A, code: 'tst', name: 'Test Agri Pty Ltd', role: 'APVMA registrant' });
  await fails('add-holder', [], { ...A, code: 'TST', name: 'Again' }, /already exists/);
  await call('add-product', [], { ...A, code: 'snl-b', name: 'Snail Bait', category: 'molluscicide', manager: 'Tester' });
  await fails('add-registration', [], { ...A, ref: 'APVMA 99001', regulator: 'APVMA', holder: 'TST' }, /Name the product/);
  await fails('add-registration', [], { ...A, ref: 'APVMA 99001', regulator: 'APVMA', holder: 'TST', product: 'SNL-B', granted: day(10), expires: '2030-07-01' }, /30 June/);
  await fails('add-registration', [], { ...A, ref: 'APVMA 99001', regulator: 'APVMA', holder: 'TST', product: 'SNL-B', ace: true }, /TGA entries only/);
  await fails('add-registration', [], { ...A, ref: 'APVMA 99001', regulator: 'Nowhere', holder: 'TST', product: 'SNL-B' }, /No matching regulator/);
  const reg = await call('add-registration', [], { ...A, ref: 'apvma 99001', regulator: 'apvma', holder: 'TST', product: 'SNL-B', applied: day(60), manager: 'Tester' });
  assert.equal(reg.status, 'application');
  assert.equal(reg.ref, 'APVMA 99001');
  await fails('add-registration', [], { ...A, ref: 'APVMA 99001', regulator: 'APVMA', holder: 'TST', product: 'SNL-B' }, /already in the register/);
  const sub = await call('lodge', ['APVMA 99001'], { ...A, kind: 'new', title: 'Registration of Snail Bait', on: day(60), 'regulator-ref': 'APP-1' });
  assert.match(sub.code, /^SUB-\d{3}$/);
  await fails('lodge', ['APVMA 99001'], { ...A, kind: 'new', title: 'x', on: day(-5) }, /future/);
  await fails('renew', ['APVMA 99001'], { ...A, on: day(1) }, /not current/);
  await fails('grant', ['APVMA 99001'], { ...A, on: day(5) }, /30 June/);
  const nextJune = fyEnding(today()) > today() ? fyEnding(today()) : addYearsIso(fyEnding(today()), 1);
  const granted = await call('grant', ['APVMA 99001'], { ...A, on: day(5), expires: nextJune });
  assert.equal(granted.status, 'current');
  assert.equal((await db.query("select outcome from submissions where code = $1", [sub.code]))[0].outcome, 'approved', 'the grant closes the new application');
  await fails('decide', [sub.code], { ...A, outcome: 'approved', on: day(1) }, /already approved/);
  await fails('grant', ['APVMA 99001'], { ...A, on: day(1), expires: nextJune }, /not an application/);
  await call('add-label', ['APVMA 99001'], { ...A, version: '1', approved: day(5) });
  await call('add-label', ['APVMA 99001'], { ...A, version: '2' });
  await fails('add-label', ['APVMA 99001'], { ...A, version: '1' }, /already on file/);
  await call('label-in-market', ['APVMA 99001'], { ...A, version: '1', on: day(4) });
  const onPack = await call('label-in-market', ['APVMA 99001'], { ...A, version: '2', on: day(2) });
  assert.match(onPack.warning, /not recorded as approved/);
  assert.ok((await db.query('select * from unapproved_labels where ref = $1', ['APVMA 99001'])).length === 1);
  assert.ok((await db.query("select retired_on from labels l join registrations r on r.id = l.registration_id where r.ref = 'APVMA 99001' and version = '1'"))[0].retired_on, 'putting a new version on pack retires the old one');
  await call('approve-label', ['APVMA 99001'], { ...A, version: '2', on: day(1) });
  assert.equal((await db.query('select * from unapproved_labels where ref = $1', ['APVMA 99001'])).length, 0);
  await fails('approve-label', ['APVMA 99001'], { ...A, version: '2', on: day(1) }, /was approved/);
  await fails('label-in-market', ['APVMA 99001'], { ...A, version: '9', on: day(1) }, /No label version 9/);
  const renewed = await call('renew', ['APVMA 99001'], { ...A, on: today(), years: '5', receipt: 'R-1' });
  assert.equal(renewed.now_expires, addYearsIso(nextJune, 5), 'a five year renewal moves the end date five years');
  assert.equal(renewed.late, today() > minusMonthIso(nextJune), 'late only after the one month cut-off');
  await fails('renew', ['APVMA 99001'], { ...A, on: today(), years: '3' }, /1 or 5/);
  await fails('renew', ['AUST L 400101'], { ...A, on: today() }, /do not renew/);
  await fails('renew', ['APVMA 88103'], { ...A, on: today() }, /de-registered/);
  await call('record-sales', ['APVMA 99001'], { ...A, fy, value: '24,000', quantity: '800', unit: 'kg' });
  await call('record-sales', ['APVMA 99001'], { ...A, fy, value: '25,000', quantity: '820', unit: 'kg' });
  assert.equal(Number((await db.query("select value_cents from sales s join registrations r on r.id = s.registration_id where r.ref = 'APVMA 99001'"))[0].value_cents), 2500000, 'recording a year again corrects it');
  await fails('record-sales', ['APVMA 99001'], { ...A, fy: '2025-12-31', value: '1' }, /30 June/);
  await fails('record-sales', ['APVMA 99001'], { ...A, fy: addYearsIso(fyEnding(today()), 1), value: '1' }, /not started/);
  const lev = await call('declare', ['APVMA 99001'], { ...A, kind: 'levy', on: today(), receipt: 'L-1' });
  assert.equal(Number(lev.value_cents), 2500000, 'the levy declaration takes the year\'s sales');
  await fails('declare', ['APVMA 99001'], { ...A, kind: 'levy', on: today() }, /already recorded/);
  await fails('declare', ['APVMA 99001'], { ...A, kind: 'ace', on: today() }, /TGA declaration/);
  await fails('declare', ['APVMA 99001'], { ...A, kind: 'return', on: fy }, /after the period/);
  await call('declare', ['APVMA 99001'], { ...A, kind: 'return', on: today() });
  await fails('declare', ['APVMA 99001'], { ...A, kind: 'bogus', on: today() }, /--kind must be/);

  // The TGA exemption: a $0 declaration only where nothing sold; turnover ends the exemption.
  await fails('declare', ['AUST L 400104'], { ...A, kind: 'ace', on: today() }, /would be false/);
  await call('declare', ['AUST L 400104'], { ...A, kind: 'turnover', on: today() });
  assert.equal((await db.query("select ace from registrations where ref = 'AUST L 400104'"))[0].ace, false);
  assert.equal((await db.query("select * from ace_turnover where ref = 'AUST L 400104'")).length, 0);
  await call('declare', ['AUST L 400102'], { ...A, kind: 'ace', on: today() });
  assert.ok(!(await db.query("select * from open_dates where ref = 'AUST L 400102' and kind = 'TGA-ACE'")).length, 'a $0 declaration clears the date');
  await fails('declare', ['AUST L 400101'], { ...A, kind: 'ace', on: today() }, /not on the annual charge exemption/);
  await call('declare', ['AICIS 2020-0457'], { ...A, kind: 'aicis', on: today() });
  await fails('declare', ['AICIS 2020-0457'], { ...A, kind: 'aicis', on: today(), period: fy }, /31 August/);

  // Fees, submissions, conditions, obligations, ending a registration.
  const fee = await call('add-fee', ['APVMA 99001'], { ...A, kind: 'renewal fee', amount: '500', due: day(-20), period: 'next year' });
  assert.match(fee.code, /^FEE-\d{3}$/);
  await fails('add-fee', ['APVMA 99001'], { ...A, kind: 'tip', amount: '5', due: day(1) }, /--kind must be/);
  await call('pay-fee', [fee.code], { ...A, on: day(0) });
  await fails('pay-fee', [fee.code], { ...A, on: day(0) }, /already paid/);
  await call('pay-fee', ['FEE-001'], { ...A, on: day(0) });
  assert.ok(!(await call('attention')).some((r) => r.ref === 'AUST L 400101' && /invoice/.test(r.item)), 'paying the invoice clears it');
  const vary = await call('lodge', ['APVMA 99001'], { ...A, kind: 'variation', title: 'New pack size', on: day(3) });
  await fails('lodge', ['APVMA 99001'], { ...A, kind: 'new', title: 'x', on: day(1) }, /variation/);
  await fails('decide', [vary.code], { ...A, outcome: 'approved', on: day(4) }, /before the lodgement/);
  await fails('decide', [vary.code], { ...A, outcome: 'maybe', on: day(1) }, /--outcome/);
  await call('decide', [vary.code], { ...A, outcome: 'approved', on: day(1) });
  await call('decide', ['SUB-001'], { ...A, outcome: 'refused', on: day(0) });
  assert.equal((await db.query("select status from registrations where ref = 'APVMA 88104'"))[0].status, 'refused', 'a refused application ends the registration');
  await call('add-condition', ['APVMA 99001'], { ...A, number: '1', text: 'Supply only in packs of 1 kg or more.' });
  await fails('add-condition', ['APVMA 99001'], { ...A, number: '1', text: 'again' }, /already on/);
  const ob = await call('add-obligation', [], { ...A, title: 'Send the field trial report', registration: 'APVMA 99001', due: day(-30) });
  assert.equal(ob.owner, 'Tester', 'an obligation defaults to the registration manager');
  await call('done', [ob.code], A);
  await fails('done', [ob.code], A, /was done/);
  await call('end', ['APVMA 88103'], { ...A, status: 'lapsed', on: fy, reason: 'Not renewed.' });
  assert.ok(!(await call('compliance')).some((r) => r.ref === 'APVMA 88103' && /de-registered/.test(r.finding)), 'marking it lapsed clears the finding');
  await fails('end', ['APVMA 88103'], { ...A, status: 'lapsed', on: fy }, /already ended/);
  await fails('add-registration', [], { ...A, ref: 'AICIS 2026-0001', regulator: 'AICIS', holder: 'TST', granted: day(30), expires: nextJune }, /31 August/);
  await fails('add-registration', [], { ...A, ref: 'AICIS 2026-0001', regulator: 'AICIS', holder: 'TST', level: '9' }, /level/);

  // Lookup: partial and case-insensitive, list-and-stop when ambiguous.
  const one = await call('registration', ['aust l400101']);
  assert.equal(one.ref, 'AUST L 400101');
  assert.ok(one.sections.find((s) => s.title === 'Labels').rows.length === 1);
  await fails('registration', ['AUST L 4001'], {}, /Ambiguous registration/);
  await fails('registration', ['ZZZ 1'], {}, /No matching registration/);
  const prod = await call('product', ['bloat']);
  assert.equal(prod.sections.find((s) => s.title === 'Registrations').rows.length, 2, 'a product shows every market it is registered in');

  // Drafts land in drafts/ and never overwrite.
  for (const c of ['weekly-review', 'draft-renewals', 'draft-levy', 'draft-ace', 'draft-aicis']) {
    const out = await call(c);
    assert.ok(fs.existsSync(out.file) && out.file.includes(`${path.sep}drafts${path.sep}`), c);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(read(out.file)), `${c} reads clean`);
  }
  const subDraft = await call('draft-submission', ['SUB-003']);
  assert.match(read(subDraft.file), /Label change/);
  assert.match(read((await call('draft-levy')).file), /Leviable value/);

  // Imports are atomic, mapped and repeatable.
  const fixtures = path.join(REPO_ROOT, 'tests', 'fixtures');
  const regs = path.join(fixtures, 'registrations.csv');
  const map = path.join(fixtures, 'map.json');
  const dry = await call('import', ['registrations', regs], { ...A, map, 'dry-run': true });
  assert.equal(dry.inserted, 3);
  assert.equal((await db.query("select * from registrations where ref like 'APVMA 9000%'")).length, 0, 'a dry run writes nothing');
  assert.equal((await call('import', ['registrations', regs], { ...A, map })).inserted, 3);
  assert.equal((await call('import', ['registrations', regs], { ...A, map })).skipped, 3, 'a repeat import skips what is there');
  assert.equal((await db.query("select status, kind from registrations where ref = 'APVMA 90002'"))[0].status, 'application');
  assert.equal((await db.query("select kind from registrations where ref = 'AUST L 412001'"))[0].kind, 'listed medicine');
  assert.equal((await db.query("select count(*)::int as n from holders where name = 'Test Sponsor Pty Ltd'"))[0].n, 1, 'one new holder for three rows');
  const sales = path.join(fixtures, 'sales.csv');
  assert.equal((await call('import', ['sales', sales], A)).inserted, 2);
  assert.equal((await call('import', ['sales', sales], A)).skipped, 2);
  const bad = path.join(dir, 'bad.csv');
  fs.writeFileSync(bad, `Registration,Status,Regulator,Holder,Granted\nAPVMA 90010,Current,APVMA,TST,${day(100)}\nAPVMA 90011,Current,APVMA,TST,\n`);
  await fails('import', ['registrations', bad], A, /needs its Granted date/);
  assert.equal((await db.query("select * from registrations where ref = 'APVMA 90010'")).length, 0, 'a failed import writes nothing');
  fs.writeFileSync(bad, 'Registration,Status,Shoe size\nAPVMA 90012,Current,9\n');
  await fails('import', ['registrations', bad], A, /Unknown column/);
  fs.writeFileSync(bad, 'Registration,Status,Regulator,Holder,Granted\nX 1,Current,Mars Agency,TST,2024-01-01\n');
  await fails('import', ['registrations', bad], A, /not set up/);
  fs.writeFileSync(bad, 'Registration,FY ending,Value\nNOPE 1,2025-06-30,10\n');
  await fails('import', ['sales', bad], A, /not in the register/);
  fs.writeFileSync(bad, 'Registration,FY ending,Value\nAPVMA 90001,2025-12-31,10\n');
  await fails('import', ['sales', bad], A, /30 June/);
  await fails('import', ['xlsx', regs], A, /Supported imports/);
  await fails('import', ['registrations', regs], { ...A, dryrun: true }, /Unknown flag/);

  // Export is complete and never overwrites.
  const exp = await call('export', [], { file: path.join(dir, 'archive.json') });
  const archive = JSON.parse(read(exp.file));
  for (const t of TABLES) assert.equal(archive[t].length, (await db.query(`select * from ${t}`)).length, t);
  await fails('export', [], { file: exp.file }, /EEXIST/);
  await fails('nonsense', [], {}, /Unknown command/);
  await fails('registrations', ['extra'], {}, /takes 0 argument/);
  await fails('add-registration', [], { ...A, ref: 'X 2', regulator: 'TGA', holder: 'TST', product: 'SNL-B', ace: 'yes' }, /takes no value/);

  assert.deepEqual(COMMANDS.filter((c) => !covered.has(c)), [], 'every CLI command is exercised');
  assert.ok((await db.query("select relrowsecurity from pg_class where relname = 'registrations'"))[0].relrowsecurity);
  await db.query("update products set name = '<script>alert(1)</script>' where code = 'MAG-N'");
  await db.close();

  // The CLI, the views and the documents as a person runs them.
  child('registrations.mjs', ['--help']);
  child('registrations.mjs', ['unknown'], 1);
  assert.ok(child('registrations.mjs', ['attention']).includes('label not approved'));
  assert.ok(JSON.parse(child('registrations.mjs', ['regulators', '--json'])).length === 5);
  assert.match(JSON.parse(child('registrations.mjs', ['registration', 'APVMA 881', '--json'], 1)).error, /Ambiguous/);
  child('view.mjs');
  child('docs.mjs');
  assert.equal(fs.readdirSync(path.join(dir, 'views')).length, 3);
  const files = fs.readdirSync(path.join(dir, 'docs-out', 'registration-summary'));
  assert.ok(files.length >= 16);
  assert.ok(fs.readdirSync(path.join(dir, 'docs-out', 'levy-working-paper')).length >= 2);
  const html = files.map((x) => read(path.join(dir, 'docs-out', 'registration-summary', x))).join('\n');
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>alert(1)</script>'), 'text is escaped in documents');

  // Every command has a slash command, and the routing table and README list them all.
  const slash = fs.readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((x) => x.endsWith('.md') && x !== 'README.md').map((x) => x.slice(0, -3));
  const claude = read(path.join(REPO_ROOT, 'CLAUDE.md'));
  const readme = read(path.join(REPO_ROOT, 'README.md'));
  for (const s of slash) {
    assert.ok(claude.includes(`\`/${s}\``), `CLAUDE.md routes /${s}`);
    assert.ok(readme.includes(`\`/${s}\``), `README lists /${s}`);
    assert.match(read(path.join(REPO_ROOT, '.claude', 'commands', `${s}.md`)), /^---\ndescription: /, `/${s} has a description`);
  }
  console.log(`PASS: ${covered.size} CLI commands, ${slash.length} slash commands; migration, idempotent seed, APVMA renewal, levy and annual return dates, the TGA annual charge exemption and turnover, AICIS renewal and declaration, labels on pack, submissions, fees, obligations, atomic registration and sales imports, drafts, export, RLS and escaped HTML (${checks} negative and subprocess checks).`);
} catch (e) {
  try { await db.close(); } catch {}
  throw e;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function addYearsIso(iso, n) { return `${Number(iso.slice(0, 4)) + n}${iso.slice(4)}`; }
function minusMonthIso(iso) { const [y, m, dd] = iso.split('-').map(Number); return m === 1 ? `${y - 1}-12-${String(dd).padStart(2, '0')}` : `${y}-${String(m - 1).padStart(2, '0')}-${String(Math.min(dd, new Date(Date.UTC(y, m - 1, 0)).getUTCDate())).padStart(2, '0')}`; }

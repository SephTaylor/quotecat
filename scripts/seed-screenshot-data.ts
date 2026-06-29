// scripts/seed-screenshot-data.ts
//
// Idempotent seed for App Store / Play Store screenshot data.
// Run: npx tsx scripts/seed-screenshot-data.ts
//
// What it does:
//   1. Finds joseph@quotecat.ai in auth.users (this is the screenshot account).
//   2. Hard-deletes all of that user's existing quotes / invoices / clients /
//      assemblies / contracts / change_orders so reruns are clean.
//   3. Upserts the profile with "Go To Electrical" branding and the financial
//      intelligence preferences (overhead, target margin, labor rates).
//   4. Inserts 5 clients, 6 quotes (spanning green/yellow/red margin states),
//      3 invoices (paid / unpaid / partial), 4 assemblies, and 1 signed
//      Premium contract.
//
// The dataset is designed so each of the 9 screenshot screens has something
// real to show — Dashboard's Business Value lights up, the margin indicator
// demos all three colors, etc.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const SCREENSHOT_EMAIL = 'joseph@quotecat.ai';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ----- date helpers ---------------------------------------------------------

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const NOW = now.toISOString();

// ----- types ----------------------------------------------------------------

type Item = { productId: string; name: string; unitPrice: number; qty: number };

const item = (productId: string, name: string, unitPrice: number, qty: number): Item => ({
  productId,
  name,
  unitPrice,
  qty,
});

// total = (materials + labor) * (1 + markup/100) * (1 + tax/100)
const calcTotal = (items: Item[], labor: number, markup: number, tax: number) => {
  const materials = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const subtotal = materials + labor;
  const withMarkup = subtotal * (1 + markup / 100);
  const withTax = withMarkup * (1 + tax / 100);
  return Math.round(withTax * 100) / 100;
};

// ----- seed -----------------------------------------------------------------

async function main() {
  console.log(`\nLooking up ${SCREENSHOT_EMAIL}...`);
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;
  const user = list.users.find((u) => u.email === SCREENSHOT_EMAIL);
  if (!user) {
    console.error(`User ${SCREENSHOT_EMAIL} not found in auth. Create it first.`);
    process.exit(1);
  }
  const userId = user.id;
  console.log(`  user_id = ${userId}`);

  // --- 1. Wipe prior screenshot data (FK-safe order) -----------------------
  console.log('\nWiping previous screenshot data...');
  // signatures depend on contracts
  const { data: priorContracts } = await supabase
    .from('contracts')
    .select('id')
    .eq('user_id', userId);
  const priorContractIds = (priorContracts ?? []).map((c) => c.id);
  if (priorContractIds.length) {
    await supabase.from('signatures').delete().in('contract_id', priorContractIds);
    await supabase.from('contract_views').delete().in('contract_id', priorContractIds);
  }
  await supabase.from('contracts').delete().eq('user_id', userId);
  await supabase.from('change_orders').delete().eq('user_id', userId);
  // invoice_payments may or may not exist as a table; try and swallow
  await supabase
    .from('invoice_payments')
    .delete()
    .eq('user_id', userId)
    .then(() => {}, () => {});
  await supabase.from('invoices').delete().eq('user_id', userId);
  await supabase.from('quotes').delete().eq('user_id', userId);
  await supabase.from('clients').delete().eq('user_id', userId);
  await supabase.from('assemblies').delete().eq('user_id', userId);
  await supabase.from('pricebook_items').delete().eq('user_id', userId);
  console.log('  done.');

  // --- 2. Profile + business settings + financial intelligence -------------
  console.log('\nUpserting profile (Go To Electrical + financial settings)...');
  const preferences = {
    dashboard: {
      showStats: true,
      showValueTracking: true,
      showPinnedQuotes: true,
      showRecentQuotes: true,
      recentQuotesCount: 5,
    },
    privacy: { analyticsEnabled: true },
    company: {
      companyName: 'Go To Electrical',
      email: 'hello@gotoelectric.net',
      phone: '(555) 887-5309',
      website: 'gotoelectric.net',
      address: '123 Main Street, Kalamazoo, MI 49001',
    },
    quote: { prefix: 'Q', nextNumber: 7 },
    invoice: { prefix: 'INV', nextNumber: 4 },
    contract: { prefix: 'CON', nextNumber: 2 },
    pricing: {
      defaultTaxPercent: 6.0,
      defaultMarkupPercent: 35.0,
      defaultLaborRate: 95.0,
      defaultLaborCostRate: 42.0,
      targetMaterialsMarginPercent: 25.0,
      zipCode: '49001',
      locationId: 'kalamazoo',
    },
    overhead: {
      annualOverhead: 48_000,
      annualLaborRevenue: 240_000,
      overheadPercent: 20.0,
      materialsMixPercent: 40.0,
      targetProfitMarginPercent: 25.0,
      completedAt: daysAgo(45),
    },
    paymentMethods: {
      zelle: { enabled: true, value: 'pay@gotoelectric.net' },
      venmo: { enabled: true, value: '@gotoelectric' },
      check: { enabled: true, value: 'Made out to Go To Electrical LLC' },
    },
    notifications: { overdueRemindersEnabled: true },
    // Mark onboarding complete so the dashboard wizard does not relaunch
    // on first sign-in and overwrite these settings with its defaults.
    onboarding: {
      completedAt: daysAgo(45),
      steps: {
        createAccount: true,
        companySetup: true,
        overheadCalc: true,
        laborRate: true,
        targetMargin: true,
      },
    },
  };

  const { error: profileErr } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: SCREENSHOT_EMAIL,
      full_name: 'Sparky McZapface',
      tier: 'premium',
      pricing_tier: 'founder',
      company_name: 'Go To Electrical',
      company_email: 'hello@gotoelectric.net',
      company_phone: '(555) 887-5309',
      company_website: 'gotoelectric.net',
      company_address: '123 Main Street, Kalamazoo, MI 49001',
      zip_code: '49001',
      preferences,
      updated_at: NOW,
    },
    { onConflict: 'id' },
  );
  if (profileErr) throw profileErr;

  // --- 3. Clients ----------------------------------------------------------
  console.log('\nInserting clients...');
  const clients = [
    {
      id: randomUUID(),
      name: 'Chad Thunderwrench',
      email: 'chad@thunderwrench.com',
      phone: '(555) 222-1010',
      address: '4421 Oakhill Drive, Kalamazoo, MI 49001',
    },
    {
      id: randomUUID(),
      name: 'Marcus Thompson',
      email: 'marcus.thompson@gmail.com',
      phone: '(555) 234-8901',
      address: '1247 Hillcrest Drive, Kalamazoo, MI 49006',
    },
    {
      id: randomUUID(),
      name: 'Oakwood Properties LLC',
      email: 'facilities@oakwoodproperties.com',
      phone: '(555) 678-3344',
      address: '800 Oakwood Plaza, Kalamazoo, MI 49006',
    },
    {
      id: randomUUID(),
      name: 'Jennifer Chen',
      email: 'jen.chen@protonmail.com',
      phone: '(555) 445-7782',
      address: '2210 Westlake Court, Portage, MI 49024',
    },
    {
      id: randomUUID(),
      name: 'Riverdale Medical Center',
      email: 'ops@riverdalemed.org',
      phone: '(555) 901-2200',
      address: '1500 Healthcare Way, Kalamazoo, MI 49008',
    },
  ];

  const { error: clientsErr } = await supabase.from('clients').insert(
    clients.map((c) => ({
      id: c.id,
      user_id: userId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      created_at: daysAgo(60),
      updated_at: daysAgo(60),
      synced_at: NOW,
    })),
  );
  if (clientsErr) throw clientsErr;

  const [chad, marcus, oakwood, chen, riverdale] = clients;

  // --- 4. Quotes (margin spread across green/yellow/red) -------------------
  console.log('\nInserting quotes...');

  // Quote 1: Chad's Ultimate Garage Gym Wiring — APPROVED, 40% markup → GREEN
  const q1Items = [
    item('p-svc-circ', 'Dedicated 20A Circuit (per run)', 145, 6),
    item('p-outlet-20a', '20A Tamper-Resistant Outlet', 18, 8),
    item('p-led-shop', 'LED Shop Light (8ft, linkable)', 95, 8),
    item('p-subpanel', '100A Subpanel w/ Breakers', 385, 1),
  ];

  // Quote 2: Thompson Kitchen Remodel Electrical — SENT, 35% markup → GREEN
  const q2Items = [
    item('p-panel-upg', '200A Main Panel Upgrade', 1450, 1),
    item('p-can-led', 'LED Recessed Can (6", dimmable)', 38, 12),
    item('p-undercab', 'Under-Cabinet LED Strip (run)', 165, 4),
    item('p-gfci', 'GFCI Outlet (kitchen-grade)', 32, 6),
    item('p-island-circ', 'Island Receptacle Circuit', 215, 2),
  ];

  // Quote 3: Oakwood Office Lighting Retrofit — APPROVED, 25% markup → YELLOW
  const q3Items = [
    item('p-troffer-led', 'LED Troffer 2x4 (50W, 5000K)', 165, 36),
    item('p-occ-sensor', 'Ceiling Occupancy Sensor', 78, 12),
    item('p-exit-led', 'LED Exit Sign w/ Battery Backup', 95, 6),
    item('p-ballast', 'Ballast Bypass Kit', 22, 36),
  ];

  // Quote 4: Chen Master Bath Electrical — DRAFT, 15% markup → RED (fix me)
  const q4Items = [
    item('p-gfci', 'GFCI Outlet (bathroom)', 32, 4),
    item('p-vanity-bar', 'Vanity Light Bar (LED)', 220, 1),
    item('p-vent-fan', 'Bath Vent Fan w/ Light & Heat', 385, 1),
    item('p-dimmer', 'Smart Dimmer Switch', 65, 3),
    item('p-mirror-led', 'Backlit LED Mirror Wiring (rough-in)', 145, 1),
  ];

  // Quote 5: Riverdale Medical Center Electrical Upgrade — SENT, 45% → GREEN
  const q5Items = [
    item('p-isol-xfmr', 'Isolation Transformer (medical grade)', 2850, 2),
    item('p-emerg-circ', 'Emergency Branch Circuit (per run)', 285, 8),
    item('p-recep-hg', 'Hospital-Grade Receptacle', 48, 32),
    item('p-redcord', 'Red Cord Emergency System (zone)', 1450, 4),
    item('p-ats', 'Automatic Transfer Switch (200A)', 4200, 1),
  ];

  // Quote 6: YouTube Studio Wiring — DRAFT, 20% markup → YELLOW
  const q6Items = [
    item('p-cable-conduit', 'Cable Conduit Run (10ft section)', 42, 6),
    item('p-iso-circ', 'Isolated-Ground Circuit (audio)', 195, 2),
    item('p-cat6', 'CAT6 Drop (Ethernet, terminated)', 75, 4),
    item('p-led-key', 'Dimmable Key-Light Circuit', 165, 2),
  ];

  const quoteRows = [
    {
      id: randomUUID(),
      number: 'Q-001',
      name: "Chad's Ultimate Garage Gym Wiring",
      client: chad,
      items: q1Items,
      labor: 1800,
      markup: 40,
      status: 'approved',
      pinned: true,
      createdDaysAgo: 38,
      updatedDaysAgo: 26,
      notes: 'Pull permit before start. Customer wants outlets every 8ft along the back wall.',
    },
    {
      id: randomUUID(),
      number: 'Q-002',
      name: 'Thompson Kitchen Remodel Electrical',
      client: marcus,
      items: q2Items,
      labor: 4500,
      markup: 35,
      status: 'sent',
      pinned: true,
      createdDaysAgo: 9,
      updatedDaysAgo: 4,
      notes: 'GC scheduling drywall for week of completion.',
    },
    {
      id: randomUUID(),
      number: 'Q-003',
      name: 'Oakwood Office Lighting Retrofit',
      client: oakwood,
      items: q3Items,
      labor: 5500,
      markup: 25,
      status: 'approved',
      pinned: false,
      createdDaysAgo: 22,
      updatedDaysAgo: 14,
      notes: 'After-hours install only. Building access via south dock.',
    },
    {
      id: randomUUID(),
      number: 'Q-004',
      name: 'Chen Master Bath Electrical',
      client: chen,
      items: q4Items,
      labor: 1800,
      markup: 15,
      status: 'draft',
      pinned: false,
      createdDaysAgo: 2,
      updatedDaysAgo: 1,
      notes: 'Review markup before sending — margin below target.',
    },
    {
      id: randomUUID(),
      number: 'Q-005',
      name: 'Riverdale Medical Electrical Upgrade',
      client: riverdale,
      items: q5Items,
      labor: 8000,
      markup: 45,
      status: 'sent',
      pinned: false,
      createdDaysAgo: 6,
      updatedDaysAgo: 6,
      notes: 'Hospital grade requirements. Coordinate w/ facilities for shutdown windows.',
    },
    {
      id: randomUUID(),
      number: 'Q-006',
      name: 'YouTube Studio Wiring',
      client: chad,
      items: q6Items,
      labor: 800,
      markup: 20,
      status: 'draft',
      pinned: false,
      createdDaysAgo: 1,
      updatedDaysAgo: 1,
      notes: 'Side project. Low markup - revisit if scope grows.',
    },
  ];

  const { error: quotesErr } = await supabase.from('quotes').insert(
    quoteRows.map((q) => ({
      id: q.id,
      user_id: userId,
      quote_number: q.number,
      name: q.name,
      client_name: q.client.name,
      client_email: q.client.email,
      client_phone: q.client.phone,
      client_address: q.client.address,
      items: q.items,
      labor: q.labor,
      markup_percent: q.markup,
      tax_percent: 6.0,
      total: calcTotal(q.items, q.labor, q.markup, 6.0),
      currency: 'USD',
      status: q.status,
      pinned: q.pinned,
      notes: q.notes,
      created_at: daysAgo(q.createdDaysAgo),
      updated_at: daysAgo(q.updatedDaysAgo),
      synced_at: NOW,
    })),
  );
  if (quotesErr) throw quotesErr;

  const [q1, q2, q3, q4, q5, q6] = quoteRows;

  // --- 5. Invoices (paid / unpaid / partial) ------------------------------
  console.log('\nInserting invoices...');

  const inv1Total = calcTotal(q1.items, q1.labor, q1.markup, 6.0);
  const inv2Total = calcTotal(q2.items, q2.labor, q2.markup, 6.0);
  const inv3Total = calcTotal(q3.items, q3.labor, q3.markup, 6.0);

  const { error: invErr } = await supabase.from('invoices').insert([
    {
      id: randomUUID(),
      user_id: userId,
      quote_id: q1.id,
      invoice_number: 'INV-001',
      name: q1.name,
      client_name: q1.client.name,
      client_email: q1.client.email,
      client_phone: q1.client.phone,
      client_address: q1.client.address,
      items: q1.items,
      labor: q1.labor,
      markup_percent: q1.markup,
      tax_percent: 6.0,
      currency: 'USD',
      status: 'paid',
      invoice_date: daysAgo(22),
      due_date: daysAhead(8),
      paid_date: daysAgo(11),
      paid_amount: inv1Total,
      created_at: daysAgo(22),
      updated_at: daysAgo(11),
      synced_at: NOW,
    },
    {
      id: randomUUID(),
      user_id: userId,
      quote_id: q2.id,
      invoice_number: 'INV-002',
      name: q2.name,
      client_name: q2.client.name,
      client_email: q2.client.email,
      client_phone: q2.client.phone,
      client_address: q2.client.address,
      items: q2.items,
      labor: q2.labor,
      markup_percent: q2.markup,
      tax_percent: 6.0,
      currency: 'USD',
      status: 'unpaid',
      invoice_date: daysAgo(4),
      due_date: daysAhead(26),
      created_at: daysAgo(4),
      updated_at: daysAgo(4),
      synced_at: NOW,
    },
    {
      id: randomUUID(),
      user_id: userId,
      quote_id: q3.id,
      invoice_number: 'INV-003',
      name: q3.name + ' (50% Deposit)',
      client_name: q3.client.name,
      client_email: q3.client.email,
      client_phone: q3.client.phone,
      client_address: q3.client.address,
      items: q3.items,
      labor: q3.labor,
      markup_percent: q3.markup,
      tax_percent: 6.0,
      currency: 'USD',
      status: 'paid',
      is_partial_invoice: true,
      percentage: 50,
      invoice_date: daysAgo(14),
      due_date: daysAhead(16),
      paid_date: daysAgo(9),
      paid_amount: Math.round(inv3Total * 0.5 * 100) / 100,
      created_at: daysAgo(14),
      updated_at: daysAgo(9),
      synced_at: NOW,
    },
  ]);
  if (invErr) throw invErr;

  // --- 6. Assemblies (Premium feature - reusable templates) ----------------
  console.log('\nInserting assemblies...');
  const { error: asmErr } = await supabase.from('assemblies').insert([
    {
      id: randomUUID(),
      user_id: userId,
      name: '200A Main Panel Upgrade',
      description: 'Standard residential service upgrade w/ permit + meter swap.',
      category: 'Electrical',
      items: [
        { productId: 'p-panel-upg', qty: 1, name: '200A Main Panel Upgrade' },
        { productId: 'p-grounding', qty: 1, name: 'Grounding Kit (rod + clamp)' },
        { productId: 'p-meter-base', qty: 1, name: 'Meter Base' },
        { productId: 'p-permit', qty: 1, name: 'Permit Fee' },
      ],
      created_at: daysAgo(120),
      updated_at: daysAgo(40),
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'Recessed Can Light (per fixture)',
      description: 'LED can light, dimmable, including wiring + trim.',
      category: 'Electrical',
      items: [
        { productId: 'p-can-led', qty: 1, name: 'LED Recessed Can (6", dimmable)' },
        { productId: 'p-romex-12', qty: 8, name: '12/2 Romex (ft)' },
        { productId: 'p-wire-nut', qty: 4, name: 'Wire Nuts' },
      ],
      created_at: daysAgo(120),
      updated_at: daysAgo(60),
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'EV Charger Install (240V, 50A)',
      description: 'Hardwired Level 2 EV charger with dedicated circuit.',
      category: 'Electrical',
      items: [
        { productId: 'p-ev-charger', qty: 1, name: 'Level 2 EV Charger (50A)' },
        { productId: 'p-breaker-50', qty: 1, name: '50A 2-Pole Breaker' },
        { productId: 'p-cable-6awg', qty: 30, name: '6 AWG Cable (ft)' },
        { productId: 'p-conduit-emt', qty: 30, name: 'EMT Conduit (ft)' },
        { productId: 'p-permit', qty: 1, name: 'Permit Fee' },
      ],
      created_at: daysAgo(85),
      updated_at: daysAgo(12),
    },
    {
      id: randomUUID(),
      user_id: userId,
      name: 'GFCI Outlet Replacement',
      description: 'Standard kitchen/bath/exterior GFCI swap.',
      category: 'Electrical',
      items: [
        { productId: 'p-gfci', qty: 1, name: 'GFCI Outlet' },
        { productId: 'p-cover-plate', qty: 1, name: 'Cover Plate' },
      ],
      created_at: daysAgo(120),
      updated_at: daysAgo(120),
    },
  ]);
  if (asmErr) throw asmErr;

  // --- 6b. Pricebook items (Pro feature - custom catalog) -----------------
  console.log('\nInserting pricebook items...');
  const pricebookItems: Array<{
    name: string;
    description?: string;
    category: string;
    unitPrice: number;
    unitType: string;
    sku?: string;
  }> = [
    // Panels & service
    { name: '200A Main Panel Upgrade', description: 'Square D QO, 40-circuit, with main breaker', category: 'Panels & Service', unitPrice: 1450, unitType: 'ea', sku: 'PNL-200A' },
    { name: '100A Subpanel Kit', description: 'With breakers, ground bar, neutral kit', category: 'Panels & Service', unitPrice: 385, unitType: 'ea', sku: 'PNL-100A-SUB' },
    { name: 'Meter Base', description: '200A overhead service entrance', category: 'Panels & Service', unitPrice: 165, unitType: 'ea', sku: 'MTR-200A' },
    { name: 'Grounding Kit', description: 'Copper rod + acorn clamp + #6 bare', category: 'Panels & Service', unitPrice: 48, unitType: 'ea', sku: 'GND-KIT' },

    // Lighting
    { name: 'LED Recessed Can (6")', description: 'Dimmable, 90 CRI, 3000K', category: 'Lighting', unitPrice: 38, unitType: 'ea', sku: 'LED-CAN-6' },
    { name: 'LED Shop Light (8ft)', description: 'Linkable, 8800 lm, 5000K', category: 'Lighting', unitPrice: 95, unitType: 'ea', sku: 'LED-SHOP-8' },
    { name: 'LED Troffer (2x4)', description: '50W, 5000K, commercial grade', category: 'Lighting', unitPrice: 165, unitType: 'ea', sku: 'LED-TRF-24' },
    { name: 'Under-Cabinet LED Strip', description: 'Per linear ft, dimmable', category: 'Lighting', unitPrice: 22, unitType: 'ft', sku: 'LED-UC' },
    { name: 'LED Exit Sign w/ Battery', description: 'Code-compliant, 90-min backup', category: 'Lighting', unitPrice: 95, unitType: 'ea', sku: 'EXIT-LED' },
    { name: 'Vanity Light Bar (LED)', description: '36" dimmable, brushed nickel', category: 'Lighting', unitPrice: 220, unitType: 'ea', sku: 'VAN-LED-36' },

    // Outlets, switches, devices
    { name: 'Standard Outlet (20A)', description: 'Tamper-resistant, commercial spec', category: 'Outlets & Switches', unitPrice: 18, unitType: 'ea', sku: 'OUT-20A' },
    { name: 'GFCI Outlet', description: 'Self-test, weather-resistant variant available', category: 'Outlets & Switches', unitPrice: 32, unitType: 'ea', sku: 'GFCI-20A' },
    { name: 'Hospital-Grade Receptacle', description: 'Green dot, isolated ground', category: 'Outlets & Switches', unitPrice: 48, unitType: 'ea', sku: 'HG-RECEP' },
    { name: 'Smart Dimmer Switch', description: 'Wi-Fi, works with Alexa / Google', category: 'Outlets & Switches', unitPrice: 65, unitType: 'ea', sku: 'DIM-SMART' },
    { name: 'Occupancy Sensor (Ceiling)', description: 'PIR, 360°, 12-min hold', category: 'Outlets & Switches', unitPrice: 78, unitType: 'ea', sku: 'OCC-CLG' },

    // Wire & conduit
    { name: '12/2 Romex w/ Ground', description: 'Per linear ft', category: 'Wire & Conduit', unitPrice: 1.25, unitType: 'ft', sku: 'ROMEX-12-2' },
    { name: '6 AWG THHN', description: 'Per linear ft, EV / range applications', category: 'Wire & Conduit', unitPrice: 3.85, unitType: 'ft', sku: 'AWG-6' },
    { name: 'EMT Conduit (1/2")', description: 'Per 10ft section', category: 'Wire & Conduit', unitPrice: 12, unitType: 'ea', sku: 'EMT-12' },
    { name: 'PVC Conduit (3/4")', description: 'Schedule 40, per 10ft', category: 'Wire & Conduit', unitPrice: 9, unitType: 'ea', sku: 'PVC-34' },

    // Specialty
    { name: 'Level 2 EV Charger Install', description: '50A hardwired, includes breaker', category: 'Specialty', unitPrice: 985, unitType: 'ea', sku: 'EV-L2-50' },
    { name: 'Bath Vent Fan w/ Light & Heat', description: 'Panasonic / Broan, code-compliant', category: 'Specialty', unitPrice: 385, unitType: 'ea', sku: 'VENT-LH' },
    { name: 'Whole-House Surge Protector', description: '80kA, type 2, panel-mounted', category: 'Specialty', unitPrice: 285, unitType: 'ea', sku: 'SURGE-WH' },

    // Labor
    { name: 'Standard Labor', description: 'Per billable hour', category: 'Labor', unitPrice: 95, unitType: 'hr', sku: 'LAB-STD' },
    { name: 'After-Hours Labor', description: 'Per billable hour, evenings + weekends', category: 'Labor', unitPrice: 142.5, unitType: 'hr', sku: 'LAB-OT' },
    { name: 'Diagnostic / Troubleshooting', description: 'First hour, includes report', category: 'Labor', unitPrice: 145, unitType: 'ea', sku: 'LAB-DX' },

    // Permits / fees
    { name: 'Permit Fee (Residential)', description: 'Pulled with city, passed through at cost', category: 'Permits', unitPrice: 185, unitType: 'ea', sku: 'PERM-RES' },
    { name: 'Permit Fee (Commercial)', description: 'Pulled with city, passed through at cost', category: 'Permits', unitPrice: 425, unitType: 'ea', sku: 'PERM-COM' },
  ];

  const { error: pbErr } = await supabase.from('pricebook_items').insert(
    pricebookItems.map((p) => ({
      id: randomUUID(),
      user_id: userId,
      name: p.name,
      description: p.description ?? null,
      category: p.category,
      unit_price: p.unitPrice,
      unit_type: p.unitType,
      sku: p.sku ?? null,
      is_active: true,
      source: 'custom',
      created_at: daysAgo(90),
      updated_at: daysAgo(30),
    })),
  );
  if (pbErr) throw pbErr;

  // --- 7. Signed contract (Premium showcase) -------------------------------
  console.log('\nInserting signed contract...');
  const contractId = randomUUID();
  const contractTotal = calcTotal(q2.items, q2.labor, q2.markup, 6.0);

  const { error: ctrErr } = await supabase.from('contracts').insert({
    id: contractId,
    user_id: userId,
    contract_number: 'CON-001',
    client_name: q2.client.name,
    client_email: q2.client.email,
    client_phone: q2.client.phone,
    client_address: q2.client.address,
    project_name: q2.name,
    scope_of_work:
      'Full kitchen electrical remodel including 200A panel upgrade, dedicated island and ' +
      'appliance circuits, 12 LED recessed cans with dimmer controls, under-cabinet lighting, ' +
      'and code-compliant GFCI / AFCI protection throughout.',
    materials: q2.items,
    labor: q2.labor,
    markup_percent: q2.markup,
    tax_percent: 6.0,
    total: contractTotal,
    payment_terms: '50% deposit on signing, 50% on completion.',
    terms_and_conditions:
      'Work performed per current NEC. Permit included. One-year workmanship warranty.',
    start_date: daysAhead(7).slice(0, 10),
    completion_date: daysAhead(35).slice(0, 10),
    status: 'signed',
    sent_at: daysAgo(8),
    viewed_at: daysAgo(7),
    signed_at: daysAgo(6),
    created_at: daysAgo(9),
    updated_at: daysAgo(6),
  });
  if (ctrErr) throw ctrErr;

  // tiny transparent png as placeholder signature image
  const transparentPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const signaturePng = `data:image/png;base64,${transparentPng}`;

  const { error: sigErr } = await supabase.from('signatures').insert([
    {
      contract_id: contractId,
      signer_type: 'contractor',
      signer_name: 'Sparky McZapface',
      signer_email: 'hello@gotoelectric.net',
      signature_image: signaturePng,
      signed_at: daysAgo(8),
    },
    {
      contract_id: contractId,
      signer_type: 'client',
      signer_name: q2.client.name,
      signer_email: q2.client.email,
      signature_image: signaturePng,
      signed_at: daysAgo(6),
    },
  ]);
  if (sigErr) throw sigErr;

  // --- summary -------------------------------------------------------------
  console.log('\n--- seed complete ---');
  console.log(`profile:       Go To Electrical (premium, founder)`);
  console.log(`clients:       ${clients.length}`);
  console.log(`quotes:        ${quoteRows.length}  (markups: ${quoteRows.map((q) => q.markup + '%').join(', ')})`);
  console.log(`invoices:      3  (paid / unpaid / 50% partial)`);
  console.log(`assemblies:    4`);
  console.log(`pricebook:     ${pricebookItems.length}  (Panels, Lighting, Outlets, Wire, Specialty, Labor, Permits)`);
  console.log(`contracts:     1 signed`);
  console.log(`\nSign in as ${SCREENSHOT_EMAIL} on the simulator to see the data sync down.`);
}

main().catch((err) => {
  console.error('\nseed failed:', err);
  process.exit(1);
});

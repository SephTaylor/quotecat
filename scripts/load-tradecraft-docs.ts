/**
 * Load tradecraft documents into Supabase with OpenAI embeddings
 *
 * Run with: npx ts-node scripts/load-tradecraft-docs.ts
 * Or: npx tsx scripts/load-tradecraft-docs.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eouikzjzsartaabvlbee.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =============================================================================
// TRADECRAFT DOCUMENTS
// =============================================================================

interface TradecraftDoc {
  trade: string;
  job_type: string;
  title: string;
  content: string;
}

const TRADECRAFT_DOCS: TradecraftDoc[] = [
  {
    trade: 'electrical',
    job_type: 'panel_upgrade',
    title: '200 Amp Panel Upgrade',
    content: `# 200 Amp Panel Upgrade

## Job Summary
Upgrading residential service from 100A (or 150A) to 200A. Often triggered by adding high-draw circuits (EV charger, workshop, HVAC upgrade) or selling/renovating home.

## Scoping Questions (ask in order)

1. What's the current panel amperage?
   - 100A (most common upgrade)
   - 150A
   - 60A or fuse box (bigger job, older home considerations)

2. Why the upgrade? (helps scope additional work)
   - Adding EV charger
   - Adding workshop/garage circuits
   - General capacity / selling home
   - Required by new HVAC system

3. Is the meter base being upgraded too?
   - Same amperage meter → just panel swap
   - Meter upgrade needed → utility coordination required
   - Some utilities require 200A meter with 200A panel

4. Where is the current panel?
   - Garage (easiest)
   - Basement
   - Exterior
   - Interior closet (may need relocation discussion)

5. How many new circuits are we adding (if any)?
   - Just the upgrade, rewire existing circuits
   - Adding 1-2 circuits
   - Adding 3+ circuits (may need subpanel discussion)

6. Permit situation?
   - Almost always required for panel work
   - Who pulls it - contractor or homeowner?
   - Inspection required before utility reconnect

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| 200A main breaker panel (Siemens, Square D, Eaton) | $150-350 | Price varies by brand, spaces |
| 2/0 Aluminum SER cable | ~$3/ft | For service entrance, length varies |
| Grounding rod + clamp | $25-40 | May need 2 rods depending on code |
| Grounding electrode conductor | $2-3/ft | #4 or #6 copper |
| Breakers (assorted) | $5-50 each | 15/20A ~$5, 50A 2-pole ~$15, GFCI/AFCI ~$35-50 |
| Weather head / mast (if replacing) | $30-75 | Often reuse existing |
| Permit fee | $75-200 | Varies by jurisdiction |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Panel swap only (same location, no new circuits) | 4-6 hrs | Disconnect, swap, reconnect, label |
| Panel swap + meter base upgrade | 6-8 hrs | Add utility coordination time |
| Panel swap + 1-2 new circuits | 5-7 hrs | +30-45 min per circuit |
| Panel swap + relocation | 8-12 hrs | New feeders, patching, etc. |

## Gotchas / Often Forgotten

- **Utility coordination**: Who calls for disconnect/reconnect? Lead time?
- **Permit inspection**: Must pass before utility reconnects - schedule ahead
- **Grounding**: Older homes may need grounding system brought up to code
- **Bonding**: Water heater, gas lines, CSST - check local requirements
- **Panel fill**: Count existing breakers + planned additions, size panel accordingly (30-space minimum recommended)
- **AFCI/GFCI requirements**: New circuits may require arc-fault or GFCI breakers per current code
- **Labeling**: All circuits must be labeled clearly - time consuming but required

## Pricing Notes

- Material markup: 20-30% typical
- Some electricians price panel upgrades as flat rate ($1,500-2,500 typical range)
- Utility fees not included in quote - pass through to customer`,
  },
  {
    trade: 'electrical',
    job_type: 'ev_charger',
    title: 'EV Charger Installation (Level 2)',
    content: `# EV Charger Installation (Level 2)

## Job Summary
Installing a 240V circuit for Level 2 EV charging. Most residential installs are 50A circuit with NEMA 14-50 outlet or hardwired charger.

## Scoping Questions (ask in order)

1. What charger are they using?
   - NEMA 14-50 outlet (universal, they plug in their own charger)
   - Hardwired unit (Tesla Wall Connector, ChargePoint, etc.)
   - They haven't decided yet (recommend 14-50 for flexibility)

2. Where will the charger be located?
   - Garage (most common)
   - Driveway/exterior
   - Carport

3. How far from the panel?
   - Under 30 ft (straightforward)
   - 30-75 ft (voltage drop calculation needed)
   - 75+ ft (may need larger wire gauge)

4. Does the panel have space for a 50A 2-pole breaker?
   - Yes, 2 open spaces → straightforward
   - No → need tandem breakers elsewhere or subpanel
   - Panel already maxed → may need panel upgrade first

5. Is panel amperage sufficient?
   - 200A panel → usually fine
   - 100A panel → load calculation needed, may trigger upgrade

6. Permit required?
   - Most jurisdictions yes for new 240V circuit
   - Some have streamlined EV permit process

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| 50A 2-pole breaker | $12-20 | Match panel brand |
| 6/3 NM-B wire (indoor) | ~$2.50/ft | Copper, most common |
| 6/3 UF-B wire (outdoor/underground) | ~$3.50/ft | If running outside |
| NEMA 14-50 outlet | $15-25 | Surface or flush mount |
| Outlet box (surface mount) | $10-20 | If not recessing |
| Conduit + fittings (if exposed) | $30-75 | EMT or PVC depending on location |
| Permit fee | $50-150 | Often less than panel work |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Short run, open panel, accessible route | 2-3 hrs | Best case |
| Medium run (30-50 ft), some drilling | 3-4 hrs | Typical garage install |
| Long run or difficult route | 4-6 hrs | Attic runs, multiple penetrations |
| Requires panel upgrade | Add panel upgrade hours | Quote separately |

## Gotchas / Often Forgotten

- **Load calculation**: 100A panels often can't support 50A EV + existing loads
- **Voltage drop**: Runs over 50ft may need #4 wire instead of #6
- **Outlet height**: Customer preference - some want high, some want low for cord management
- **Future-proofing**: Consider running conduit even if not needed now
- **Utility rebates**: Some utilities offer EV charger rebates - mention to customer
- **Tesla vs universal**: Tesla Wall Connector needs hardwire, verify what customer actually has
- **Permit timing**: Some areas backed up on EV permits - set expectations

## Pricing Notes

- Many electricians offer flat rate EV installs ($400-800 typical, depending on run length)
- "Up to 30 feet from panel" is common flat rate boundary
- Beyond that, price per foot for additional run`,
  },
  {
    trade: 'electrical',
    job_type: 'recessed_lighting',
    title: 'Recessed Lighting Installation',
    content: `# Recessed Lighting Installation

## Job Summary
Installing recessed (can) lights in residential ceiling. Common in kitchens, living rooms, basements. Typically LED wafer style or traditional housings.

## Scoping Questions (ask in order)

1. How many lights?
   - Get exact count
   - If they're unsure, ask room dimensions and help calculate (general rule: one 6" light per 4-6 sq ft in kitchens, more spacing okay in living areas)

2. What type of lights?
   - LED wafer/slim (no housing, mounts to drywall - easier)
   - Traditional IC-rated housing with trim (more work, but some prefer the look)
   - Retrofit into existing housings (just swapping)

3. Is there existing lighting in the room?
   - Replacing a central fixture → can reuse that circuit/switch
   - Adding new where there was none → new circuit or extending existing
   - Adding to supplement existing → switching considerations

4. What's above the ceiling?
   - Attic access (easiest)
   - Second floor / occupied space above (hardest)
   - Flat roof with no access
   - Basement with open joists (easy)

5. What type of ceiling?
   - Drywall (standard)
   - Plaster (harder to cut, more careful)
   - Drop ceiling (different approach entirely)

6. Dimmer or regular switch?
   - Dimmer → need compatible dimmer switch, verify LED compatibility
   - Standard on/off
   - Smart switch integration

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| LED wafer light (6") | $12-25 each | Cheapest at big box in multi-packs |
| IC-rated housing | $8-15 each | If going traditional route |
| LED trim/module for housing | $15-30 each | Retrofit or new |
| 14/2 or 12/2 NM-B wire | ~$0.50-0.75/ft | Depending on circuit amperage |
| Dimmer switch (LED compatible) | $25-60 | Lutron, Leviton common |
| Single pole switch | $3-8 | If not dimming |
| Wire nuts, boxes, staples | $15-30 | Misc supplies |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Per light - attic access, wafer style | 20-30 min each | After first light, faster |
| Per light - no attic, fishing wires | 45-60 min each | Significant time increase |
| New circuit + switch | Add 1-2 hrs | Running new home run |
| Dimmer installation | Add 15-30 min | Slightly more wiring |

**Example: 6 wafer lights in kitchen, attic access, existing switch location**
- 6 lights × 25 min = 2.5 hrs
- Switch/dimmer work = 30 min
- Total: ~3 hrs

## Gotchas / Often Forgotten

- **IC rating**: If insulation contact possible, must use IC-rated housings
- **Joist direction**: Layout may need adjustment based on joist/truss locations
- **Vapor barriers**: Some ceilings have vapor barriers - need proper sealing
- **Hole saws**: Different light sizes need different hole saws
- **Load on circuit**: Adding 6+ lights to existing circuit - verify capacity
- **Dimmer compatibility**: Not all LED lights dim well with all dimmers - check specs
- **Ceiling height**: Vaulted or tall ceilings add ladder time and complexity
- **Plaster ceilings**: More dust, more careful cutting, old wiring concerns
- **Patching**: If light locations change, who patches old holes?

## Pricing Notes

- Often priced per light ($75-150/light installed is typical range)
- First light costs more (setup, running circuit), additional lights less
- Attic access vs fishing can be 2x price difference
- Some electricians price by the room for simplicity`,
  },
  {
    trade: 'electrical',
    job_type: 'outlet_circuit',
    title: 'Outlet or Circuit Addition',
    content: `# Outlet or Circuit Addition

## Job Summary
Adding new electrical outlet(s) or dedicated circuit. Ranges from simple single outlet to multiple outlets on new circuit.

## Scoping Questions (ask in order)

1. What's the outlet for?
   - General use (15A standard)
   - Specific appliance - which one? (determines if dedicated circuit needed)
   - Home office (may want dedicated circuit)
   - Outdoor (GFCI required)
   - Garage (GFCI required)

2. How many outlets?
   - Single outlet
   - Multiple outlets on same circuit
   - Multiple locations, multiple circuits

3. 120V or 240V?
   - Standard outlet = 120V
   - Appliances that need 240V: dryer, range, welder, large compressor, some AC units

4. Where exactly?
   - Get specific location
   - Interior wall vs exterior wall (exterior = more insulation, harder fishing)
   - Height preference

5. What's the nearest power source?
   - Existing outlet nearby to extend from
   - Need new home run to panel
   - Basement/attic/crawl space access?

6. Is there panel space?
   - If dedicated circuit, need open breaker space
   - If extending existing circuit, verify it's not overloaded

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| Standard duplex outlet (15A) | $2-5 | Residential grade |
| 20A outlet | $5-10 | For 20A circuits (kitchen, bath, garage) |
| GFCI outlet | $15-25 | Required in wet/outdoor locations |
| Single gang box (new work) | $1-3 | If open wall |
| Single gang box (old work/remodel) | $3-5 | Cuts into existing drywall |
| 14/2 NM-B wire | ~$0.50/ft | For 15A circuits |
| 12/2 NM-B wire | ~$0.75/ft | For 20A circuits |
| 15A breaker | $5-8 | If new circuit |
| 20A breaker | $6-10 | If new circuit |
| Cover plates | $1-3 | Don't forget these |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Add outlet, extend from nearby outlet, accessible | 1-1.5 hrs | Easiest case |
| Add outlet, fishing through finished walls | 2-3 hrs | Time varies a lot by building |
| New dedicated circuit, panel nearby, accessible route | 2-3 hrs | Home run adds time |
| New dedicated circuit, difficult route | 3-5 hrs | Attic + walls + basement |
| Each additional outlet on same circuit | +30-45 min | After first one |

## Gotchas / Often Forgotten

- **GFCI requirements**: Kitchens, baths, garages, outdoors, basements all need GFCI protection
- **AFCI requirements**: Bedrooms, living areas may require AFCI breaker (check local code)
- **20A circuits required**: Kitchen countertop, bathroom, laundry, garage
- **Dedicated circuits required**: Microwave, dishwasher, disposal, fridge (some jurisdictions)
- **Box fill**: Don't overload junction boxes
- **Wire gauge**: 15A circuit = 14ga minimum, 20A circuit = 12ga minimum
- **Exterior boxes**: Must be weatherproof rated
- **Insulation**: Exterior wall fishing much harder than interior
- **Permit**: Single outlet often no permit, new circuit usually yes

## Pricing Notes

- Single outlet addition: $150-300 typical (depends heavily on fishing difficulty)
- Dedicated circuit: $250-500 typical
- Price per outlet drops when doing multiple on same circuit
- "Accessible" vs "not accessible" is the main price driver`,
  },
];

// =============================================================================
// EMBEDDING GENERATION
// =============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('Loading tradecraft documents...\n');

  for (const doc of TRADECRAFT_DOCS) {
    console.log(`Processing: ${doc.title}`);

    // Generate embedding from title + content
    const textToEmbed = `${doc.title}\n\n${doc.content}`;
    console.log(`  Generating embedding (${textToEmbed.length} chars)...`);

    const embedding = await generateEmbedding(textToEmbed);
    console.log(`  Embedding generated (${embedding.length} dimensions)`);

    // Upsert into Supabase
    const { error } = await supabase
      .from('tradecraft_docs')
      .upsert({
        trade: doc.trade,
        job_type: doc.job_type,
        title: doc.title,
        content: doc.content,
        embedding: embedding,
        is_active: true,
      }, {
        onConflict: 'trade,job_type',
      });

    if (error) {
      console.error(`  ERROR: ${error.message}`);
    } else {
      console.log(`  ✓ Saved to database`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\nDone! Loaded', TRADECRAFT_DOCS.length, 'tradecraft documents.');
}

main().catch(console.error);

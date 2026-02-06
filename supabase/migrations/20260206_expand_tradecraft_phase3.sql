-- =============================================================================
-- Phase 3: Expand Tradecraft Knowledge Base
-- =============================================================================
-- Adds scoping questions to existing docs and creates new electrical job types
-- =============================================================================

-- =============================================================================
-- UPDATE: EV Charger - Add scoping questions
-- =============================================================================
UPDATE tradecraft_docs
SET scoping_questions = '[
  {
    "id": "charger_type",
    "storeAs": "chargerType",
    "question": "What type of EV charger are we installing?",
    "quickReplies": ["Tesla Wall Connector", "ChargePoint", "Other Level 2", "Customer providing"]
  },
  {
    "id": "panel_distance",
    "storeAs": "panelDistance",
    "question": "How far is the panel from where the charger will be mounted?",
    "quickReplies": ["Under 25 ft", "25-50 ft", "50-100 ft", "Over 100 ft"]
  },
  {
    "id": "panel_capacity",
    "storeAs": "panelCapacity",
    "question": "Does the panel have room for a 50A breaker?",
    "quickReplies": ["Yes, spaces available", "No, panel is full", "Not sure"]
  },
  {
    "id": "mounting_location",
    "storeAs": "mountingLocation",
    "question": "Where will the charger be mounted?",
    "quickReplies": ["Garage wall", "Exterior wall", "Pedestal/post", "Inside near panel"]
  }
]'::jsonb,
content = '# EV Charger Installation (Level 2)

## Job Summary
Installing a Level 2 (240V) EV charger, typically 40-50 amp circuit. Most common: Tesla Wall Connector, ChargePoint Home, or hardwired NEMA 14-50 outlet.

## Scoping Questions (ask in order)

1. What type of charger?
   - Tesla Wall Connector (hardwired, 48A max)
   - ChargePoint or similar (hardwired or plug-in)
   - NEMA 14-50 outlet (plug-in chargers)
   - Customer providing the unit

2. Distance from panel to charger location?
   - Under 25 ft (easy run)
   - 25-50 ft (standard)
   - 50-100 ft (may need larger wire for voltage drop)
   - Over 100 ft (definitely upsizing wire)

3. Panel capacity?
   - Spaces available for 50A 2-pole breaker
   - Panel full - may need subpanel or tandem breakers
   - 100A service - may need load calculation

4. Mounting location?
   - Garage (most common, easiest)
   - Exterior (weatherproof box needed)
   - Pedestal mount (concrete work)

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| 50A 2-pole breaker | $15-25 | Match panel brand |
| 6/3 NM-B (Romex) | $3-4/ft | For indoor runs under 50 ft |
| 6/3 UF-B | $4-5/ft | For outdoor/underground |
| 6 AWG THHN in conduit | $1.50/ft per conductor | Alternative to cable |
| NEMA 14-50 outlet | $15-25 | If not hardwiring |
| Weatherproof box | $20-40 | For exterior installations |
| Conduit & fittings | Varies | If exposed run |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Simple garage install, panel nearby | 2-3 hrs | Shortest run |
| Garage, panel in basement | 3-4 hrs | Fishing wire through |
| Exterior mount | 4-5 hrs | Weatherproofing, conduit |
| Long run (50+ ft) | 4-6 hrs | More wire pulling |

## Gotchas

- **Voltage drop**: Over 50 ft, may need to upsize to 4 AWG
- **Panel capacity**: 100A service may not support 50A charger + existing loads
- **Permit**: Usually required for new 240V circuit
- **Tesla specifics**: Wall Connector needs 60A breaker for full 48A output
- **Load management**: Some chargers can share circuits or reduce output'
WHERE job_type = 'ev_charger';

-- =============================================================================
-- UPDATE: Recessed Lighting - Add scoping questions
-- =============================================================================
UPDATE tradecraft_docs
SET scoping_questions = '[
  {
    "id": "light_count",
    "storeAs": "lightCount",
    "question": "How many recessed lights are we installing?",
    "quickReplies": ["4 lights", "6 lights", "8 lights", "10+ lights"]
  },
  {
    "id": "ceiling_type",
    "storeAs": "ceilingType",
    "question": "What type of ceiling?",
    "quickReplies": ["Drywall (standard)", "Drywall (insulated above)", "Drop/suspended", "Vaulted/cathedral"]
  },
  {
    "id": "existing_switch",
    "storeAs": "existingSwitch",
    "question": "Is there an existing switch we can tie into?",
    "quickReplies": ["Yes, existing switch", "No, need new switch", "Want dimmer"]
  },
  {
    "id": "attic_access",
    "storeAs": "atticAccess",
    "question": "Is there attic access above the ceiling?",
    "quickReplies": ["Yes, easy access", "Yes, tight space", "No attic access"]
  }
]'::jsonb,
content = '# Recessed Lighting Installation

## Job Summary
Installing recessed (can) lights in existing ceiling. Includes cutting holes, running wire, and connecting to switch.

## Scoping Questions (ask in order)

1. How many lights?
   - 4 lights (small room)
   - 6 lights (medium room)
   - 8+ lights (large room or multiple areas)

2. Ceiling type?
   - Standard drywall - straightforward
   - Insulated ceiling - need IC-rated cans
   - Drop ceiling - use drop ceiling kits
   - Vaulted - may need special housings

3. Switch situation?
   - Existing switch to tap into
   - Need to run new switch leg
   - Want dimmer switch

4. Attic access?
   - Good attic access - easy wiring
   - Tight attic - more difficult
   - No attic - fishing wire required

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| 6" LED recessed light (IC rated) | $15-30 each | Wafer style most popular now |
| 14/2 NM-B (Romex) | $0.50-0.75/ft | For daisy-chaining lights |
| Single-pole switch | $3-5 | Basic on/off |
| Dimmer switch | $20-50 | LED-compatible required |
| Wire nuts, boxes | $10-20 | Miscellaneous |
| Hole saw (6") | $15-25 | If not using template |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| 4 lights, attic access | 2-3 hrs | Straightforward |
| 6 lights, attic access | 3-4 hrs | Standard job |
| 6 lights, no attic | 4-6 hrs | Fishing wire adds time |
| 8+ lights, new circuit | 5-7 hrs | More complex |

## Gotchas

- **IC rating**: If insulation present, must use IC-rated housings
- **Dimmer compatibility**: LED lights need LED-compatible dimmers
- **Spacing**: Generally 4-6 ft apart, 2-3 ft from walls
- **Junction boxes**: Each light is a junction box - accessible
- **Existing wiring**: Check if circuit can handle additional load'
WHERE job_type = 'recessed_lighting';

-- =============================================================================
-- UPDATE: Outlet/Circuit Addition - Add scoping questions
-- =============================================================================
UPDATE tradecraft_docs
SET scoping_questions = '[
  {
    "id": "outlet_purpose",
    "storeAs": "outletPurpose",
    "question": "What will this outlet be used for?",
    "quickReplies": ["General use (15A)", "Kitchen/bathroom (20A GFCI)", "Dedicated appliance", "Outdoor"]
  },
  {
    "id": "new_or_extend",
    "storeAs": "newOrExtend",
    "question": "New circuit from panel, or extend existing circuit?",
    "quickReplies": ["New circuit", "Extend nearby circuit", "Not sure"]
  },
  {
    "id": "wall_type",
    "storeAs": "wallType",
    "question": "What type of wall?",
    "quickReplies": ["Interior drywall", "Exterior wall", "Basement/concrete", "Finished basement"]
  },
  {
    "id": "outlet_count",
    "storeAs": "outletCount",
    "question": "How many outlets are we adding?",
    "quickReplies": ["Just 1", "2-3 outlets", "4+ outlets"]
  }
]'::jsonb,
content = '# Outlet or Circuit Addition

## Job Summary
Adding new electrical outlets or running a new circuit from the panel. Ranges from simple outlet addition to dedicated circuits for appliances.

## Scoping Questions (ask in order)

1. What is the outlet for?
   - General use (15A standard)
   - Kitchen/bathroom counter (20A GFCI required)
   - Dedicated appliance (fridge, microwave, etc.)
   - Outdoor (GFCI + weatherproof)

2. New circuit or extend existing?
   - New home run from panel
   - Tap into nearby existing circuit
   - Depends on load and code requirements

3. Wall type?
   - Interior drywall - easier fishing
   - Exterior wall - insulation to deal with
   - Concrete/block - surface mount or core drill

4. How many outlets?
   - Single outlet
   - Multiple outlets on same circuit
   - Multiple rooms

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| 15A outlet | $2-3 | Standard duplex |
| 20A outlet | $4-6 | T-slot, for 20A circuits |
| GFCI outlet | $15-25 | Kitchen, bath, outdoor, garage |
| Outlet box (old work) | $2-4 | For retrofit in drywall |
| 14/2 NM-B | $0.50/ft | For 15A circuits |
| 12/2 NM-B | $0.75/ft | For 20A circuits |
| 15A or 20A breaker | $5-8 | If new circuit |
| Cover plates | $1-3 | Match decor |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Single outlet, extend circuit | 1-2 hrs | Shortest job |
| Single outlet, new circuit | 2-3 hrs | Panel work included |
| 2-3 outlets, same room | 2-3 hrs | Daisy chain |
| New circuit + multiple outlets | 3-4 hrs | Full installation |

## Gotchas

- **GFCI requirements**: Kitchen counters, bathrooms, outdoors, garages
- **AFCI requirements**: Bedrooms and living areas in new circuits
- **20A circuits**: Kitchen small appliance circuits must be 20A
- **Dedicated circuits**: Fridge, microwave, dishwasher often need own circuit
- **Box fill**: Dont overcrowd junction boxes'
WHERE job_type = 'outlet_circuit';

-- =============================================================================
-- NEW: Ceiling Fan Installation
-- =============================================================================
INSERT INTO tradecraft_docs (
  job_type,
  trade,
  title,
  content,
  scoping_questions,
  materials_checklist,
  is_active
) VALUES (
  'ceiling_fan',
  'electrical',
  'Ceiling Fan Installation',
  '# Ceiling Fan Installation

## Job Summary
Installing a ceiling fan, either replacing an existing light fixture or new installation. Includes proper box support, wiring, and assembly.

## Scoping Questions (ask in order)

1. Replacing existing fixture or new location?
   - Replacing light fixture (existing box)
   - New location (no existing box)
   - Replacing old ceiling fan

2. Is the existing box fan-rated?
   - Yes, fan-rated box
   - No/unsure (most light boxes arent)
   - New installation needed

3. Switch situation?
   - Existing switch works
   - Want separate fan/light control
   - Want remote control

4. Ceiling height?
   - Standard 8 ft
   - 9-10 ft (may need downrod)
   - Vaulted (special mount needed)

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| Fan-rated ceiling box | $15-25 | Required for fans |
| Fan brace bar | $20-35 | For between-joist mounting |
| Ceiling fan | $75-300 | Customer usually provides |
| Downrod | $15-30 | For high ceilings |
| Fan-rated box with brace | $30-45 | Combo unit |
| Remote control kit | $25-50 | If not included with fan |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Replace fixture, box is fan-rated | 1-1.5 hrs | Just swap and wire |
| Replace fixture, need new box | 2-3 hrs | Box replacement |
| New location, attic access | 3-4 hrs | Full installation |
| New location, no attic | 4-5 hrs | Fishing wire |

## Gotchas

- **Box rating**: Light fixture boxes are NOT rated for fans - must replace
- **Weight rating**: Box must be rated for fan weight (35-70 lbs typical)
- **Bracing**: Between-joist locations need brace bar or fan-rated pancake box
- **Vaulted ceilings**: Need angled mount adapter
- **Remote interference**: Some remotes conflict with neighbors',
  '[
    {
      "id": "existing_or_new",
      "storeAs": "existingOrNew",
      "question": "Replacing an existing fixture or new location?",
      "quickReplies": ["Replacing light fixture", "Replacing old fan", "New location"]
    },
    {
      "id": "box_rated",
      "storeAs": "boxRated",
      "question": "Is the existing ceiling box fan-rated?",
      "quickReplies": ["Yes, fan-rated", "No/not sure", "New installation"]
    },
    {
      "id": "switch_preference",
      "storeAs": "switchPreference",
      "question": "How do you want to control the fan?",
      "quickReplies": ["Existing switch", "Separate fan/light switches", "Remote control"]
    },
    {
      "id": "ceiling_height",
      "storeAs": "ceilingHeight",
      "question": "What is the ceiling height?",
      "quickReplies": ["Standard 8 ft", "9-10 ft", "Vaulted/cathedral"]
    }
  ]'::jsonb,
  '{
    "items": [
      {
        "category": "fan_box",
        "name": "Fan-rated ceiling box",
        "searchTerms": ["fan rated box", "ceiling fan box"],
        "defaultQty": 1,
        "unit": "ea",
        "required": true,
        "notes": "Required unless existing box is fan-rated"
      },
      {
        "category": "brace",
        "name": "Fan brace bar",
        "searchTerms": ["fan brace", "ceiling fan bracket"],
        "defaultQty": 1,
        "unit": "ea",
        "required": false,
        "notes": "For between-joist mounting"
      },
      {
        "category": "wire",
        "name": "14/2 NM-B wire",
        "searchTerms": ["14/2 romex", "14-2 wire"],
        "defaultQty": 25,
        "unit": "ft",
        "required": false,
        "notes": "Only if running new circuit"
      },
      {
        "category": "switch",
        "name": "Fan control switch",
        "searchTerms": ["ceiling fan switch", "fan speed control"],
        "defaultQty": 1,
        "unit": "ea",
        "required": false,
        "notes": "For separate fan/light control"
      }
    ]
  }'::jsonb,
  true
);

-- =============================================================================
-- NEW: Smoke Detector Installation/Replacement
-- =============================================================================
INSERT INTO tradecraft_docs (
  job_type,
  trade,
  title,
  content,
  scoping_questions,
  materials_checklist,
  is_active
) VALUES (
  'smoke_detectors',
  'electrical',
  'Smoke Detector Installation',
  '# Smoke Detector Installation/Replacement

## Job Summary
Installing or replacing hardwired smoke detectors and CO detectors. Code requires interconnected detectors so all alarms sound together.

## Scoping Questions (ask in order)

1. New installation or replacing existing?
   - Replacing old hardwired detectors
   - Adding detectors (home has none/battery only)
   - Upgrading to combo smoke/CO

2. How many detectors needed?
   - Code minimum varies by home size
   - Generally: each bedroom + hallway + each level

3. Are existing detectors interconnected?
   - Yes, wired together
   - No, independent
   - Battery only currently

4. Attic/crawl space access?
   - Good attic access
   - Limited access
   - No access (fishing required)

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| Hardwired smoke detector | $25-40 | With battery backup |
| Smoke/CO combo | $35-50 | Recommended for bedrooms |
| 14/3 NM-B | $0.75/ft | For interconnect wire (red wire) |
| Old work box | $2-4 | For retrofit installations |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Replace existing (same brand) | 0.5-1 hr | Plug and play |
| Replace existing (different brand) | 1-2 hrs | May need adapter plates |
| New installation, 4-6 detectors | 4-6 hrs | Full wiring job |
| Add detectors to existing system | 2-3 hrs | Tie into existing interconnect |

## Code Requirements

- **Bedrooms**: Detector inside each bedroom
- **Hallways**: Detector in hallway serving bedrooms
- **Levels**: At least one per level including basement
- **CO detectors**: Required near sleeping areas in most jurisdictions
- **Interconnection**: All detectors must sound together
- **Power**: Hardwired with battery backup required in most new work

## Gotchas

- **Compatibility**: Interconnected detectors should be same brand/series
- **Age**: Replace detectors older than 10 years
- **Placement**: Not too close to kitchen or bathroom (false alarms)
- **Battery backup**: All hardwired units should have battery backup',
  '[
    {
      "id": "new_or_replace",
      "storeAs": "newOrReplace",
      "question": "New installation or replacing existing detectors?",
      "quickReplies": ["Replacing old detectors", "New installation", "Adding to existing"]
    },
    {
      "id": "detector_count",
      "storeAs": "detectorCount",
      "question": "How many detectors are needed?",
      "quickReplies": ["3-4 detectors", "5-6 detectors", "7+ detectors"]
    },
    {
      "id": "detector_type",
      "storeAs": "detectorType",
      "question": "Smoke only or smoke/CO combo?",
      "quickReplies": ["Smoke only", "Smoke/CO combo", "Mix of both"]
    },
    {
      "id": "attic_access",
      "storeAs": "atticAccess",
      "question": "Is there attic access for running wire?",
      "quickReplies": ["Yes, good access", "Limited access", "No attic access"]
    }
  ]'::jsonb,
  '{
    "items": [
      {
        "category": "smoke_detector",
        "name": "Hardwired smoke detector",
        "searchTerms": ["smoke detector hardwired", "smoke alarm 120v"],
        "defaultQty": 4,
        "unit": "ea",
        "required": true
      },
      {
        "category": "combo_detector",
        "name": "Smoke/CO combo detector",
        "searchTerms": ["smoke co detector", "combination detector"],
        "defaultQty": 2,
        "unit": "ea",
        "required": false,
        "notes": "For bedrooms and hallways"
      },
      {
        "category": "wire",
        "name": "14/3 NM-B wire",
        "searchTerms": ["14/3 romex", "14-3 wire"],
        "defaultQty": 75,
        "unit": "ft",
        "required": true,
        "notes": "Red wire for interconnect"
      },
      {
        "category": "boxes",
        "name": "Old work ceiling boxes",
        "searchTerms": ["old work box ceiling", "remodel box"],
        "defaultQty": 4,
        "unit": "ea",
        "required": true
      }
    ]
  }'::jsonb,
  true
);

-- =============================================================================
-- NEW: Electric Range/Dryer Circuit
-- =============================================================================
INSERT INTO tradecraft_docs (
  job_type,
  trade,
  title,
  content,
  scoping_questions,
  materials_checklist,
  is_active
) VALUES (
  'range_dryer_circuit',
  'electrical',
  '240V Range or Dryer Circuit',
  '# 240V Range or Dryer Circuit

## Job Summary
Installing a dedicated 240V circuit for an electric range (50A) or electric dryer (30A). Includes running cable from panel to outlet location.

## Scoping Questions (ask in order)

1. Range or dryer?
   - Electric range (50A)
   - Electric dryer (30A)
   - Both circuits needed

2. Distance from panel?
   - Same room/adjacent (under 25 ft)
   - Across house (25-50 ft)
   - Different floor (basement to kitchen)

3. Outlet type needed?
   - 4-prong (modern, NEMA 14-50 or 14-30)
   - 3-prong (older style, NEMA 10)
   - Hardwired (no outlet)

4. Is there a clear path for the cable?
   - Open basement/crawl below
   - Attic access above
   - Finished walls (fishing required)

## Common Materials

| Item | Typical Price | Notes |
|------|---------------|-------|
| 50A 2-pole breaker | $15-25 | For range |
| 30A 2-pole breaker | $12-20 | For dryer |
| 6/3 NM-B (range) | $4-5/ft | 50A circuit |
| 10/3 NM-B (dryer) | $2.50-3/ft | 30A circuit |
| NEMA 14-50 outlet | $15-25 | 4-prong range |
| NEMA 14-30 outlet | $12-20 | 4-prong dryer |
| 4" square box | $5-8 | For outlet mounting |

## Labor Estimation

| Scenario | Hours | Notes |
|----------|-------|-------|
| Short run, open path | 2-3 hrs | Straightforward |
| Medium run, some fishing | 3-4 hrs | Typical job |
| Long run or difficult path | 4-6 hrs | More complex |
| Both range and dryer | 5-7 hrs | Two circuits |

## Code Notes

- **4-wire required**: New installations must use 4-prong outlets (separate ground)
- **No shared neutrals**: Each 240V circuit needs dedicated neutral
- **Dedicated circuit**: Cannot share with other outlets or loads
- **Strain relief**: Required where cable enters box

## Gotchas

- **Wire size matters**: 50A needs 6 AWG, 30A needs 10 AWG
- **Old 3-prong**: Can keep existing 3-prong, but 4-prong recommended
- **Gas conversion**: If switching to electric, may need new circuit
- **Panel space**: Need 2 adjacent slots for 2-pole breaker',
  '[
    {
      "id": "appliance_type",
      "storeAs": "applianceType",
      "question": "Is this for a range or dryer?",
      "quickReplies": ["Electric range (50A)", "Electric dryer (30A)", "Both"]
    },
    {
      "id": "panel_distance",
      "storeAs": "panelDistance",
      "question": "How far is the panel from the appliance location?",
      "quickReplies": ["Under 25 ft", "25-50 ft", "Different floor"]
    },
    {
      "id": "outlet_type",
      "storeAs": "outletType",
      "question": "What outlet type is needed?",
      "quickReplies": ["4-prong (modern)", "3-prong (existing)", "Not sure"]
    },
    {
      "id": "cable_path",
      "storeAs": "cablePath",
      "question": "Is there a clear path for running the cable?",
      "quickReplies": ["Yes, open basement", "Yes, attic access", "Finished walls"]
    }
  ]'::jsonb,
  '{
    "items": [
      {
        "category": "breaker_50a",
        "name": "50A 2-pole breaker",
        "searchTerms": ["50 amp breaker 2 pole", "50A double pole"],
        "defaultQty": 1,
        "unit": "ea",
        "required": true,
        "notes": "For range circuit"
      },
      {
        "category": "breaker_30a",
        "name": "30A 2-pole breaker",
        "searchTerms": ["30 amp breaker 2 pole", "30A double pole"],
        "defaultQty": 1,
        "unit": "ea",
        "required": false,
        "notes": "For dryer circuit"
      },
      {
        "category": "wire_6_3",
        "name": "6/3 NM-B cable",
        "searchTerms": ["6/3 romex", "6-3 wire NM"],
        "defaultQty": 35,
        "unit": "ft",
        "required": true,
        "notes": "For 50A range circuit"
      },
      {
        "category": "wire_10_3",
        "name": "10/3 NM-B cable",
        "searchTerms": ["10/3 romex", "10-3 wire NM"],
        "defaultQty": 35,
        "unit": "ft",
        "required": false,
        "notes": "For 30A dryer circuit"
      },
      {
        "category": "outlet_range",
        "name": "NEMA 14-50 outlet",
        "searchTerms": ["14-50 outlet", "range outlet 4 prong"],
        "defaultQty": 1,
        "unit": "ea",
        "required": true
      },
      {
        "category": "outlet_dryer",
        "name": "NEMA 14-30 outlet",
        "searchTerms": ["14-30 outlet", "dryer outlet 4 prong"],
        "defaultQty": 1,
        "unit": "ea",
        "required": false
      }
    ]
  }'::jsonb,
  true
);

-- =============================================================================
-- Update keywords in state machine (done via trade-agents.ts, but document here)
-- =============================================================================
-- ceiling_fan: ceiling fan, fan install, fan installation
-- smoke_detectors: smoke detector, smoke alarm, co detector, carbon monoxide
-- range_dryer_circuit: range outlet, dryer outlet, 240v outlet, stove outlet

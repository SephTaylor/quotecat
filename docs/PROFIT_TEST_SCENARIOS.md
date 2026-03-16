# Profit Calculation Test Scenarios

## Test Configuration

**User:** pro@quotecat.ai

**Pricing Settings:**
- Billable Rate: $50/hr (`defaultLaborRate`)
- Cost Rate: $30/hr (`defaultLaborCostRate`)
- Cost Ratio: 30/50 = **60%**
- Default Markup: 20%
- Default Tax: 6%

**Overhead Settings:**
- Target Profit Margin: 20%
- Overhead completed: Yes

---

## Test Quote 1: Labor Heavy

**Quote ID:** `test_cost_1_labor_heavy`

### Inputs
| Field | Value |
|-------|-------|
| Materials | 2 items @ $100 = **$200** |
| Material Estimate | $0 |
| Labor | **$400** (8 hrs @ $50/hr billed) |
| Markup | 20% |
| Tax | 6% |

### Quote Totals Calculation
```
Materials from items:     $200.00
Markup (20% of $200):    + $40.00
Materials with markup:    $240.00
Material estimate:       + $0.00
Labor:                   + $400.00
─────────────────────────────────
Subtotal:                 $640.00
Tax (6%):                + $38.40
─────────────────────────────────
TOTAL:                    $678.40
```

### Profit Calculation
```
Revenue (subtotal):       $640.00
Materials cost:          - $200.00  (before markup)
Labor cost:              - $240.00  ($400 × 0.60 cost ratio)
─────────────────────────────────
PROFIT:                   $200.00
MARGIN:                   31.25%    ($200 / $640)
```

### Expected Result
- **Profit:** $200.00
- **Margin:** 31.25% (GREEN - above 20% target)

---

## Test Quote 2: Materials Heavy

**Quote ID:** `test_cost_2_materials_heavy`

### Inputs
| Field | Value |
|-------|-------|
| Materials | 10 items @ $100 = **$1,000** |
| Material Estimate | $0 |
| Labor | **$100** (2 hrs @ $50/hr billed) |
| Markup | 20% |
| Tax | 6% |

### Quote Totals Calculation
```
Materials from items:     $1,000.00
Markup (20% of $1000):   + $200.00
Materials with markup:    $1,200.00
Material estimate:       + $0.00
Labor:                   + $100.00
─────────────────────────────────
Subtotal:                 $1,300.00
Tax (6%):                + $78.00
─────────────────────────────────
TOTAL:                    $1,378.00
```

### Profit Calculation
```
Revenue (subtotal):       $1,300.00
Materials cost:          - $1,000.00  (before markup)
Labor cost:              - $60.00     ($100 × 0.60 cost ratio)
─────────────────────────────────
PROFIT:                   $240.00
MARGIN:                   18.46%      ($240 / $1,300)
```

### Expected Result
- **Profit:** $240.00
- **Margin:** 18.46% (YELLOW - within 5% of 20% target)

---

## Test Quote 3: Balanced

**Quote ID:** `test_cost_3_balanced`

### Inputs
| Field | Value |
|-------|-------|
| Materials | 5 items @ $100 = **$500** |
| Material Estimate | $0 |
| Labor | **$250** (5 hrs @ $50/hr billed) |
| Markup | 20% |
| Tax | 6% |

### Quote Totals Calculation
```
Materials from items:     $500.00
Markup (20% of $500):    + $100.00
Materials with markup:    $600.00
Material estimate:       + $0.00
Labor:                   + $250.00
─────────────────────────────────
Subtotal:                 $850.00
Tax (6%):                + $51.00
─────────────────────────────────
TOTAL:                    $901.00
```

### Profit Calculation
```
Revenue (subtotal):       $850.00
Materials cost:          - $500.00  (before markup)
Labor cost:              - $150.00  ($250 × 0.60 cost ratio)
─────────────────────────────────
PROFIT:                   $200.00
MARGIN:                   23.53%    ($200 / $850)
```

### Expected Result
- **Profit:** $200.00
- **Margin:** 23.53% (GREEN - above 20% target)

---

## Summary Table

| Quote | Materials | Labor | Total | Profit | Margin | Color |
|-------|-----------|-------|-------|--------|--------|-------|
| Test 1: Labor Heavy | $200 | $400 | $678.40 | $200.00 | **31.25%** | GREEN |
| Test 2: Materials Heavy | $1,000 | $100 | $1,378.00 | $240.00 | **18.46%** | YELLOW |
| Test 3: Balanced | $500 | $250 | $901.00 | $200.00 | **23.53%** | GREEN |

---

## Key Formula

```
costRatio = defaultLaborCostRate / defaultLaborRate
         = $30 / $50 = 0.60 (60%)

laborCost = laborBilled × costRatio
profit = subtotal - materialsCost - laborCost
margin = profit / subtotal × 100
```

---

## Margin Color Thresholds

Based on target margin of 20%:
- **GREEN:** margin >= 20% (at or above target)
- **YELLOW:** margin >= 15% and < 20% (within 5% of target)
- **RED:** margin < 15% (more than 5% below target)

---

## How to Verify

1. Open QuoteCat app as pro@quotecat.ai
2. Pull to refresh to sync the test quotes
3. Open each quote and check the profit indicator shows:
   - Test 1: ~31% margin (GREEN)
   - Test 2: ~18% margin (YELLOW)
   - Test 3: ~24% margin (GREEN)

If all indicators show RED or wrong values, check:
- Is `defaultLaborCostRate` set? (should be $30)
- Is `defaultLaborRate` set? (should be $50)
- Is overhead settings completed?

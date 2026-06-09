# Kendall Electric — Pricebook Feature + Syndication Partnership Opportunity

**Source:** Master electrician user / friend (introduced via the user). Has an active relationship with Kendall Electric and offered a warm intro to their e-commerce team.

**Strategic significance:** This is the strongest signal in months for revisiting the supplier-data play. Both a "real trades user wants this" data point AND a "warm partnership intro" data point in one conversation. Specifically named in FOLLOWUPS.md as a condition for revisiting the deferred xByte work.

---

## Two distinct opportunities

### Opportunity A — Personal pricebook CSV import (ship this first)

A contractor downloads their negotiated pricing CSV/XLS from any supplier portal and uploads it to their personal QuoteCat pricebook. Mapped columns: SKU, name, unit, price. Bulk-imports into the existing pricebook.

Kendall has this already on the supply side:

> "The Price Sheet Download screen allows you to retrieve a CSV or XLS file with your current pricing on products on the specific Kendall Group site you are currently logged into."
>
> "You will see an option to download a Re-Order Pad Price Book, which is a list of all products bought from that specific Kendall Group shop site, by your company, in the last year."

Requires the contractor's Account Manager to enable + Sales Manager to approve (one-time, free for existing Kendall customers).

**Scope:** ~3-5 hours mobile + ~1-2 hours portal. Portal may already have a bulk-import path per the earlier audit — verify before building.

**Files involved (estimate):**
- Mobile: `app/(main)/pricebook-import.tsx` *(new)* + file picker + CSV parser + column-mapping UI + bulk insert against `pricebook_items`
- Portal: `src/app/dashboard/pricebook/import/page.tsx` *(verify exists; portal audit referenced "CSV import/export" capability)*

**Tier gating:** Free+. Sized as table-stakes; doesn't gate.

**User value:** Master electrician (and every other contractor with negotiated supplier pricing) can bring their real numbers into QuoteCat without manually re-entering hundreds of SKUs. Margin calculations become accurate.

**No external dependency:** Ships without any Kendall partnership — just uses the CSV the contractor already has access to.

### Opportunity B — Kendall e-catalog syndication partnership (the bigger play)

Kendall provides their full product catalog on a regular feed (likely weekly). QuoteCat hosts it as a shared product catalog. All users browse Kendall products from inside the app. Per-user pricing (from Opportunity A's CSV upload or, ambitious, an OAuth'd Kendall account) overlays the shared default prices for margin math.

Kendall's formal program for this:

> "Kendall Electric can provide you with an e-file of catalog items if your procurement system does not have the ability to PunchOut to shop.kendallelectric.com. They are able to syndicate their e-catalog data for uploading to your e-catalog."

**Contact:** `ecommerce@kendallgroup.com`

They also support PunchOut (cXML / OCI — the B2B procurement standard) for real-time integration with their shop. That's enterprise-tier and a future Premium feature; the e-file syndication is the immediate path.

### Two-tier pricing model

This is the model the user articulated, and Kendall's existing commerce structure supports it natively:

| Tier | Source | Visible to | Used for |
|---|---|---|---|
| **Default list price** | Kendall syndicated catalog feed | Every QuoteCat user browsing Kendall items | Display, default quote price |
| **Personal pricing** | Contractor's own price sheet (CSV upload or OAuth pull) | Only the contractor who uploaded | Margin / profit calculations, overrides default in their own quotes |

Two-tier captures the truth: Kendall publishes a list price, but each contractor pays what they negotiated. QuoteCat's financial-intelligence layer needs the personal price, not the list.

---

## Why Kendall is a better partner than xByte ever was

xByte was deferred (per `FOLLOWUPS.md:11-29`) because scraping big-box prices is a "data comprehensiveness" play and big-box stores don't want to help. Kendall is the opposite:

| Factor | Big-box (xByte's target) | Kendall (B2B wholesale) |
|---|---|---|
| Their customer | Consumers buying directly | Contractors |
| Our presence in their funnel | Competing for the consumer | Customer-acquisition channel |
| Data sharing willingness | Hostile / scraped | Has a formal syndication program |
| Pricing model | One price for everyone | List + per-customer (matches our two-tier) |
| Scale of partner | National giant | Regional, agile, negotiable |
| Trades relevance | All categories | 100% electrical-trades focused |

The xByte infrastructure (`suppliers`, `products`, `categories`, `product_prices` tables, `ingest-prices` edge function, the catalog kill switch flag) was the right architecture, just the wrong supplier type. Kendall is the right supplier type.

---

## Recommended sequence

1. **This week — ship Opportunity A.**
   - Build the CSV pricebook import (mobile + portal)
   - Master electrician gets immediate value
   - Validates the data model works without external dependency
   - Proves the contractor's appetite for "bring your real pricing" before negotiating with Kendall

2. **In parallel — start the Kendall conversation.**
   - Ask master electrician for the warm intro to `ecommerce@kendallgroup.com`
   - Draft email frame: *"We have a master electrician — your customer — using QuoteCat to quote jobs. He pulls his price sheet from your portal manually today. We'd love to talk about formalizing that — your syndicated e-catalog feeding our quoting app's product browser, with his personal price sheet overlaying. 30 minutes to explore?"*
   - Goal of first call: terms (free/paid), format (file type, refresh cadence), legal (can we redistribute prices in-app?), pilot scope

3. **If the call lands well — scope Opportunity B as a v1.3 or v1.4 anchor feature.**
   - Re-enable the xByte-era infrastructure under a Kendall-specific adapter
   - Build app-side browse of supplier catalog
   - Contractor onboarding flow: "Do you buy from Kendall? Connect your account."

4. **If Kendall works, generalize the pattern.**
   - Border States, Graybar, Rexel, Wesco, City Electric Supply, Crescent Electric — all regional/national electrical distributors with similar B2B syndication capabilities
   - Beyond electrical: plumbing (Ferguson, MORSCO), HVAC (Johnstone Supply), etc.
   - One adapter per partner; same data model; same contractor experience

---

## Verified facts about Kendall Electric

- **Headquartered:** Portage, Michigan
- **Founded:** 1973
- **Ownership:** 100% employee-owned
- **Business model:** Electrical wholesale distributor (B2B), part of The Kendall Group
- **Tech stack** (per LeadIQ): Salesforce, NoSQL, Epicor Eclipse, jQuery UI, HubSpot, Nginx, Microsoft IIS
- **Mobile app:** Kendall Electric OE Touch (iOS, mobile ordering)
- **E-commerce site:** shop.kendallelectric.com (already has authenticated price sheet download)
- **Service area:** Great Lakes / Midwest US, ~80 locations
- **Formal e-commerce services page:** kendallelectric.com/Services/ECommerce
- **Contact for syndication:** ecommerce@kendallgroup.com

---

## Open questions for the Kendall conversation

1. **File format** — CSV? XML (cXML)? JSON? PIES (Product Information Exchange Standard)?
2. **Refresh cadence** — daily / weekly / on-change?
3. **Coverage** — full Kendall catalog or just selected categories?
4. **Default pricing included** — list prices, or just SKUs + descriptions?
5. **Per-customer pricing access** — does Kendall expose an authenticated API for a contractor's own price sheet, or only the manual portal download?
6. **Legal/redistribution** — can we display Kendall list prices in the QuoteCat app? Any attribution requirements?
7. **Reciprocity expectations** — is there a fee, revenue share, or order attribution expected?
8. **Pilot vs production** — can we start with a single contractor (the master electrician) as a pilot before scaling to all users?
9. **PunchOut** — at what scale (paying contractors with Kendall accounts) does PunchOut become worth integrating?

---

## Files / infrastructure to re-leverage from xByte

From the existing codebase (referenced in `FOLLOWUPS.md`, `CLAUDE.md` Supplier API section, `docs/codebase-health-audit-2026-06-01.md`):

- `suppliers` table — schema already supports multiple suppliers per-product
- `products` table — full product catalog schema
- `categories` table — category taxonomy
- `product_prices` table — per-supplier, per-location, per-week price history
- `locations` table — Kalamazoo, Battle Creek, Lansing seeded; mostly relevant for Kendall too since they're Michigan-based
- `current_prices` view — auto-filters to latest price
- `sync-xbyte` edge function — adapt to `sync-kendall`
- `ingest-prices` edge function — generic price ingestion already exists
- `INGEST_API_KEY` auth pattern — proven, reusable

The schema doesn't need to change. The ingestion adapter does.

---

## Sources

- [Kendall Electric homepage](https://www.kendallelectric.com/)
- [Kendall Electric Shop](https://shop.kendallelectric.com/)
- [Price Book Download Help — Kendall Electric](https://shop.kendallelectric.com/pricebookhelp)
- [Kendall Electric Shop FAQs](https://shop.kendallelectric.com/FAQs)
- [Kendall Electric E-Commerce Services](https://www.kendallelectric.com/Services/ECommerce)
- [Contact Us — Kendall Electric](https://shop.kendallelectric.com/contactus)
- [The Kendall Group homepage](https://www.kendallgroup.com/)
- [Kendall Electric OE Touch mobile app — App Store](https://apps.apple.com/us/app/kendall-electric-oe-touch/id618516420)

---

*Saved 2026-06-09. Pick up when ready to discuss next steps.*

// QuoteCat Startup Kit - Styled with Brand Colors
// Orange: #F97316 | Dark: #1a1a1a | White: #f5f5f5

#set page(
  paper: "us-letter",
  margin: (x: 0.5in, y: 0.5in),
  fill: white,
  header: context {
    if counter(page).get().first() > 1 [
      #align(right)[#text(fill: rgb("#555555"), size: 8pt)[quotecat.ai]]
    ]
  },
  footer: context align(center)[
    #text(fill: rgb("#555555"), size: 8pt)[
      #counter(page).display() | quotecat.ai
    ]
  ]
)

#set text(font: "Helvetica Neue", fill: rgb("#1a1a1a"), size: 9.5pt, hyphenate: false)

#set par(leading: 0.75em, spacing: 1.4em, justify: false)

#show heading.where(level: 1): it => {
  v(0.25in)
  block(width: 100%, fill: rgb("#F97316"), inset: (x: 10pt, y: 8pt), radius: 3pt)[
    #text(fill: rgb("#000000"), weight: "bold", size: 13pt)[#it.body]
  ]
  v(0.15in)
}

#show heading.where(level: 2): it => {
  v(0.22in)
  text(fill: rgb("#F97316"), weight: "bold", size: 10.5pt)[#it.body]
  v(0.1in)
}

#show heading.where(level: 3): it => {
  v(0.15in)
  text(fill: rgb("#1a1a1a"), weight: "bold", size: 9.5pt)[#it.body]
  v(0.06in)
}

#show link: it => text(fill: rgb("#F97316"))[#it]

#let todo(content) = {
  v(0.08in)
  pad(left: 0.2in)[
    #grid(columns: (14pt, 1fr), gutter: 8pt,
      box(stroke: 1.5pt + rgb("#F97316"), width: 11pt, height: 11pt, radius: 2pt),
      content
    )
  ]
}

#let source(content) = {
  text(fill: rgb("#555555"), size: 8pt, style: "italic")[#content]
}

#let celebrate(content) = {
  box(fill: rgb("#F97316"), inset: (x: 8pt, y: 4pt), radius: 3pt)[
    #text(fill: white, weight: "bold", size: 9pt)[#content]
  ]
}

#let indent(content) = {
  pad(left: 0.25in)[#content]
}

// ===== TITLE PAGE =====
#page(margin: 0pt, footer: none)[
  // Orange header band
  #box(
    width: 100%,
    height: 2.8in,
    fill: rgb("#F97316"),
  )[
    #align(center + horizon)[
      #box(
        fill: white,
        radius: 50%,
        inset: 20pt,
      )[
        #image("../assets/images/qc-logo-large-white-tpnt.png", width: 1.2in)
      ]
    ]
  ]

  // Content area
  #v(0.6in)
  #align(center)[
    #text(fill: rgb("#1a1a1a"), size: 32pt, weight: "bold", tracking: -0.5pt)[The 90-Day]
    #v(0.08in)
    #text(fill: rgb("#F97316"), size: 32pt, weight: "bold", tracking: -0.5pt)[Contractor Startup Kit]
    #v(0.3in)
    #box(width: 3in, height: 3pt, fill: rgb("#F97316"))
    #v(0.3in)
    #text(fill: rgb("#555555"), size: 12pt)[A No-BS Checklist for Starting Your \ Contracting Business the Right Way]
    #v(1.5in)
    #text(fill: rgb("#F97316"), weight: "bold", size: 11pt)[quotecat.ai]
    #v(0.1in)
    #text(fill: rgb("#999999"), size: 9pt)[© 2026 QuoteCat]
  ]
]

// ===== CONTENT =====

= Section 1: You Can Do This (How to Do It Right)

You've got the skills. You've put in the years. Now you're ready to build something of your own.

Starting a contracting business is one of the most rewarding paths you can take. You set your schedule, choose your customers, and build real wealth, not just a paycheck. Thousands of skilled tradespeople make this leap every year and thrive.

*Here's the truth: most new businesses succeed.*

According to the U.S. Bureau of Labor Statistics, *80% of new businesses survive their first year.* The contractors who make it aren't necessarily more talented, they're just more prepared. And that's exactly what this guide is for.

#source[Source: U.S. Bureau of Labor Statistics, Business Employment Dynamics (2024)]

*You're already ahead of most people just by reading this. Let's make sure you're set up for success.*

#v(0.15in)
#block(fill: rgb("#F0FDF4"), inset: 14pt, radius: 6pt, width: 100%)[
  #text(fill: rgb("#16A34A"), weight: "bold", size: 11pt)[FREE TOOLS INCLUDED]
  #v(0.08in)
  #text(size: 10pt)[This guide comes with free online calculators to help you price jobs right:]
  #v(0.06in)
  #text(size: 9.5pt)[
    • *Labor Rate Calculator* — Figure out what to charge per hour \
    • *Markup Calculator* — See your profit on every job \
    • *Profit Margin Calculator* — Know what you can afford to spend before you bid
  ]
  #v(0.06in)
  #link("https://quotecat.ai/resources")[#text(fill: rgb("#16A34A"), weight: "bold", size: 10pt)[→ quotecat.ai/resources]]
]
#v(0.1in)

== The One Thing That Trips People Up: Cash Flow

Here's something experienced contractors wish someone had told them earlier: you can stay busy and still struggle financially if you don't manage your cash flow.

A U.S. Bank study found that cash flow challenges are behind most business struggles, not lack of work or skill. The good news? It's completely manageable once you understand it.

In construction, getting paid can take 60-90 days. That's normal. The key is planning for it: get deposits upfront, invoice immediately, and keep a cash cushion. (We'll cover exactly how in *Section 4*.)

#source[Source: U.S. Bank Small Business Study]

== Quick Gut Check: Where Do You Stand?

This isn't a test, it's a tool to help you see where you're strong and where you might want to shore things up.

Check the boxes that apply:

#todo[I have *some financial runway* saved up (or a working spouse/partner who can cover bills while I ramp up)]
#todo[I'm *confident in my trade skills* (journeyman level or solid real-world experience)]
#todo[I have a sense of *what I'll charge* (or I'm ready to figure it out, Section 6 will help)]
#todo[I know *a few people who'd hire me* to get started (friends, family, former coworkers)]
#todo[I can handle *some income uncertainty* while I build momentum]
#todo[I've thought about *what I'd do* if I needed to pivot]

*What your answers tell you:*
- *5-6 checked:* You're in great shape. Go for it with confidence.
- *3-4 checked:* Solid foundation. Consider the side hustle approach to reduce risk.
- *0-2 checked:* You can absolutely still do this, just give yourself more runway.

== Side Hustle vs. Cold Start

=== The Side Hustle Path
#indent[
  Keep your day job. Build customers on weekends and evenings. Transition to full-time when revenue is consistent.

  *Timeline:* 12-24 months (typical)

  *Pros:* Lower financial risk, time to learn the business side, build customer base before you need it

  *Cons:* Slower growth, less availability, exhausting to work two jobs

  *Best for:* People with limited savings, those who need health insurance, first-time business owners.
]

=== The Cold Start Path
#indent[
  Quit your job. Go all-in from day one with runway saved.

  *Timeline:* Consider having 6-12 months of personal expenses saved (minimum)

  *Pros:* Full focus, more availability, faster growth potential

  *Cons:* Higher financial risk, stress of no steady income, no safety net

  *Best for:* People with more savings, an existing customer base, or a working spouse/partner.
]

=== The Anchor Client Strategy
#indent[
  The smartest approach: find one client who can provide 50%+ of your income before you quit.

  This might be:
  - A general contractor who needs a reliable sub
  - A property manager with regular maintenance needs
  - A business owner who needs ongoing work
]

== Runway Calculator

#table(
  columns: (1fr, 1fr, 1fr),
  fill: (_, row) => if row == 0 { rgb("#F97316") } else if calc.odd(row) { rgb("#f5f5f5") } else { white },
  inset: 6pt,
  [*Monthly Expenses*], [*6 Months (Min)*], [*12 Months (Rec)*],
  [\$3,000], [\$18,000], [\$36,000],
  [\$4,000], [\$24,000], [\$48,000],
  [\$5,000], [\$30,000], [\$60,000],
  [\$6,000], [\$36,000], [\$72,000],
)

*Add 20% buffer* for unexpected costs (equipment breaks, slow month, emergency).

= Section 2: Legal Setup Checklist

Get the paperwork right from day one. It's not as hard as you think.

== Business Structure (Do This First)

=== Sole Proprietorship
#indent[
  - *Simplest option* - No special paperwork beyond a business license
  - *Cost:* \$0-\$50 depending on local requirements
  - *Consideration:* No separation between you and your business legally
]

=== LLC (Limited Liability Company)
#indent[
  - *Recommended for most contractors*
  - *Cost:* \$50-\$500 depending on state (one-time filing fee)
  - *Benefit:* Protects your personal assets from business liabilities
  - *Tax treatment:* "Pass-through" - business income goes on your personal taxes
]

=== S-Corporation
#indent[
  - *Consider once you're making \$75K+ profit*
  - *Cost:* More expensive (\$500-\$2,000+ annually for accounting)
  - *Benefit:* Potential tax savings through salary/dividend split
]

*Recommendation:* Start as an LLC. The \$100-\$300 filing fee is worth it for the protection.

#source[Consult an accountant before choosing your structure.]

== Federal Requirements

=== EIN (Employer Identification Number)
#indent[
  - *What it is:* A tax ID for your business (like a Social Security number)
  - *Cost:* Free
  - *How to get it:* IRS.gov → Apply Online → Takes 5 minutes
  - *Why you need it:* Required for business bank accounts, hiring, and looks professional
]

== State Contractor License Requirements

*33 states require a state-level contractor license.* 17 states have no statewide requirement.

#table(
  columns: (1fr, 0.8fr, 0.8fr, 0.8fr),
  fill: (_, row) => if row == 0 { rgb("#F97316") } else if calc.odd(row) { rgb("#f5f5f5") } else { white },
  inset: 5pt,
  [*State*], [*Required?*], [*Threshold*], [*Bond?*],
  [California], [Yes], [>\$500], [\$25,000],
  [Texas], [Trade only], [A/C, plumb, elec], [Varies],
  [Florida], [Yes], [All work], [\$10K-\$20K],
  [New York], [No (NYC yes)], [Check local], [Varies],
  [Georgia], [Yes], [>\$2,500], [\$25K min],
  [Washington], [Yes], [All work], [\$15K-\$30K],
)

#source[See the included State Licensing Quick Reference for all 50 states.]

== The Legal Setup Checklist

*Do in Week 1:*
#todo[Decide on business structure (LLC recommended)]
#todo[File LLC paperwork with your state's Secretary of State]
#todo[Get EIN from IRS.gov (free, takes 5 minutes)]
#todo[Open business bank account (requires EIN)]

*Do in Week 2-4:*
#todo[Check state contractor license requirements for your state]
#todo[Apply for state contractor license (if required)]
#todo[Apply for local business license (almost always required)]
#todo[Check trade-specific license requirements (electricians, plumbers, HVAC)]
#todo[Apply for surety bond (if required by your state)]

= Section 3: Insurance Checklist

Insurance is one of the best investments you'll make. It protects your business, your personal assets, and gives customers confidence in hiring you.

== Required: General Liability Insurance
#indent[
  - *What it covers:* Property damage, bodily injury, personal injury claims
  - *Coverage amount:* \$1 million per occurrence / \$2 million aggregate
  - *Typical cost:* \$82-\$150/month depending on trade and location
  - *Who requires it:* Almost every client, GC, and property manager

  #source[Source: MoneyGeek Contractor Insurance Report (2026); Insureon]
]

== Required If You Have Employees: Workers Compensation
#indent[
  - *What it covers:* Medical expenses and lost wages if an employee is injured
  - *When required:* Most states require WC as soon as you have 1 employee
  - *Typical cost:* \$142-\$254/month depending on trade and payroll
]

== Required If Using Vehicle for Work: Commercial Auto
#indent[
  - *What it covers:* Accidents while driving to/from job sites
  - *Why you need it:* Personal auto policies typically exclude business use
  - *Typical cost:* \$80-\$200/month
]

== Insurance Cost Estimates by Trade

#table(
  columns: (1fr, 0.8fr, 0.8fr, 1fr),
  fill: (_, row) => if row == 0 { rgb("#F97316") } else if calc.odd(row) { rgb("#f5f5f5") } else { white },
  inset: 5pt,
  [*Trade*], [*GL Only*], [*GL + WC*], [*GL + WC + Auto*],
  [Electrician], [\$100-150/mo], [\$200-300/mo], [\$300-450/mo],
  [Plumber], [\$100-140/mo], [\$200-300/mo], [\$280-400/mo],
  [HVAC], [\$120-180/mo], [\$220-350/mo], [\$320-500/mo],
  [Painter], [\$60-100/mo], [\$150-250/mo], [\$230-400/mo],
  [GC], [\$85-150/mo], [\$180-320/mo], [\$280-450/mo],
)

== Insurance Checklist

#todo[Get quotes from at least 3 insurance providers (prices vary wildly)]
#todo[Purchase general liability insurance (\$1M minimum)]
#todo[Get commercial auto insurance if using your vehicle for work]
#todo[Check if your state requires workers comp for solo contractors]
#todo[Consider inland marine coverage for tools]
#todo[Get a certificate of insurance (COI) to share with clients]

*What to tell the insurance agent:*
+ Your trade and typical job types
+ Estimated annual revenue (even if \$0 to start)
+ Whether you have or will have employees
+ What equipment/tools you own
+ Your service area

= Section 4: Money Setup

*Master this section and you'll be ahead of most contractors.*

Cash flow is the \#1 thing that keeps contractors thriving. The good news? It's not complicated once you understand it.

== Bank Accounts (A Great First Step)

=== Business Checking Account
#indent[
  *Why:* Keep business money completely separate from personal money.

  - Keeping things separate makes bookkeeping SO much easier
  - Tax time becomes simple instead of stressful
  - You'll always know exactly how your business is doing

  *How to open:* Bring your EIN, LLC documents, and ID to any bank.
]

=== Business Savings Account
#indent[
  *Why:* Set aside money for taxes and emergencies.

  *Rule of thumb:* Transfer 25-30% of every payment you receive into savings for taxes.
]

== Payment Terms

*Small Jobs (<\$2,000):* Due on completion. Cash, check, or card accepted.

*Medium Jobs (\$2,000-\$10,000):* 50% deposit to start, 50% due on completion.

*Large Jobs (>\$10,000):* 30-50% deposit, progress payments at milestones, 10% on final walkthrough.

== The Cash Flow Mindset

*Invoice the same day you finish.* The sooner you send it, the sooner you get paid.

*Follow up on overdue invoices.* A friendly check-in 3-5 days after the due date usually does the trick.

*Protect your time.* If a client hasn't paid for job \#1, it's okay to wait before starting job \#2.

*Use payment milestones on bigger jobs.* Bill at stages so you're not waiting until the end to get paid.

= Section 5: Tools & Equipment (Minimum Viable Kit)

You don't need everything on day one. Here's what you actually need to start.

*The mindset:*
- Start lean. Buy quality basics, rent specialty tools.
- Used commercial equipment is often better than new consumer-grade.
- Your truck is a tool. It doesn't need to be new.

== Starter Kit by Trade

=== Electrician (\$3,000-\$8,000)
#indent[
  #todo[Quality multimeter (\$100-\$300)]
  #todo[Wire stripper/cutter set (\$150-\$300)]
  #todo[Fish tape and pull rods (\$100-\$200)]
  #todo[Drill and impact driver (\$200-\$400)]
  #todo[Voltage tester, circuit tracer (\$100-\$250)]
  #todo[Tool bag/box, hand tools (\$200-\$400)]
  #todo[Safety gear: gloves, glasses, hard hat (\$100-\$200)]
  #todo[Basic inventory: wire nuts, connectors, breakers (\$500-\$1,000)]
]

=== Plumber (\$5,000-\$12,000)
#indent[
  #todo[Pipe wrench set (3-4 sizes) (\$200-\$400)]
  #todo[Tubing cutter, pipe cutter (\$100-\$200)]
  #todo[Drain snake/auger (\$200-\$500)]
  #todo[Propane torch, solder kit (\$100-\$200)]
  #todo[PEX tools (crimper, cutter) (\$200-\$400)]
  #todo[Drill with hole saws (\$300-\$500)]
  #todo[Basic inspection camera (\$200-\$500)]
  #todo[Initial inventory: fittings, valves, parts (\$1,000-\$2,000)]
]

=== HVAC (\$5,000-\$15,000)
#indent[
  #todo[Refrigerant recovery machine (\$500-\$800)]
  #todo[Vacuum pump (\$200-\$400)]
  #todo[Manifold gauge set (\$150-\$300)]
  #todo[Leak detector (\$100-\$300)]
  #todo[Multimeter with clamp (\$100-\$300)]
  #todo[Basic hand and power tools (\$300-\$500)]
  #todo[Initial refrigerant stock (\$500-\$1,000)]
  #todo[EPA 608 certification (\$150-\$200 for exam)]
]

=== Painter (\$500-\$2,000)
#indent[
  #todo[Quality brushes, rollers, extension poles (\$100-\$200)]
  #todo[Drop cloths, tape, plastic sheeting (\$50-\$100)]
  #todo[5-gallon buckets, mixing tools (\$30-\$50)]
  #todo[Step ladder (6-8 ft) (\$100-\$150)]
  #todo[Caulk gun, putty knives, scrapers (\$50-\$100)]
  #todo[Optional: Airless sprayer (\$300-\$1,500) - rent until volume justifies]
]

=== General Contractor (\$2,000-\$10,000)
#indent[
  #todo[Circular saw, miter saw (\$200-\$500)]
  #todo[Drill and impact driver (\$200-\$400)]
  #todo[Levels, squares, tape measures (\$100-\$200)]
  #todo[Ladders (step + extension) (\$200-\$400)]
  #todo[Basic hand tool kit (\$200-\$400)]
  #todo[Safety gear (\$100-\$200)]
]

= Section 6: Your First 10 Customers

You don't need a marketing budget. You need 10 people who trust you.

== The Friends & Family Launch
#indent[
  Your first 5-10 jobs will likely come from people who already know you. That's not cheating, that's smart business.

  *Action steps:*
  + Make a list of everyone you know who owns a home or business
  + Tell them you're starting your contracting business
  + Ask: "Do you know anyone who needs [your trade] work?"
  + Optional: Offer a "friends and family" rate for your first few jobs

  *Tip:* Even for friends and family, charge something. It values your skills and sets healthy expectations.
]

== The Neighborhood Effect
#indent[
  One of the best marketing strategies costs nothing: do great work, and neighbors notice.

  *Be proactive:*
  - Carry business cards in your pocket
  - Introduce yourself to neighbors who walk by
  - Ask your customer: "Would you mind if I left a few cards with your neighbors?"

  *The "while you're here" opportunity:* Many contractors report that their most profitable days come from "while you're here" jobs.

  #source[Pro tip: Having a quoting app on your phone (like QuoteCat) lets you send a professional estimate on the spot before the neighbor forgets or calls someone else.]
]

== Pricing Your First Jobs
#indent[
  Here's something that might feel counterintuitive: *you don't need to be the cheapest to get work.*

  - Calculate what you'd earn as an employee (hourly wage)
  - Your rate should be AT LEAST 2x that (to cover overhead, taxes, and profit)
  - If quoting a price feels slightly uncomfortable, you're probably in the right range

  The right clients value quality, reliability, and professionalism. Price yourself accordingly.

  #v(0.15in)
  #block(fill: rgb("#F0FDF4"), inset: 12pt, radius: 4pt, width: 100%)[
    #text(fill: rgb("#16A34A"), weight: "bold", size: 10pt)[FREE TOOL:] Use our Labor Rate Calculator to figure out what to charge per hour based on your income goals: #link("https://quotecat.ai/resources/labor-rate-calculator")[#text(fill: rgb("#16A34A"), weight: "bold")[quotecat.ai/resources/labor-rate-calculator]]
  ]
]

== Building Reputation from Day One
#indent[
  #todo[Take before/after photos of every job (you'll need these for marketing)]
  #todo[Ask happy customers for Google reviews (87% of people read reviews before hiring)]
  #todo[Create a Google Business Profile (free, essential)]
  #todo[Respond to every review, even negative ones (shows you care)]

  *The best referrals happen without asking.* Do great work, leave the jobsite cleaner than you found it, and be easy to work with. Happy customers tell their friends.
]

= Section 7: Looking Professional (Day One)

You don't need a fancy brand to look professional. Here's what actually matters.

== Identity Basics (Week 1)

=== Business Cards
#indent[
  Yes, they still matter. When you meet someone on a job site or at the hardware store, you need something to hand them.

  - *Where to get them:* Vistaprint, Canva Print
  - *Cost:* \$20-\$40 for 500 cards
  - *What to include:* Name, trade, phone, email, license number (if applicable)
]

=== Simple Logo
#indent[
  You don't need to spend \$500 on a designer. You need something clean and readable.

  - *Free AI option:* ChatGPT, Claude, or other AI tools can generate a solid logo in minutes
  - *DIY option:* Canva.com (also free) - use a template
  - *Budget option:* Fiverr (\$20-\$50)
]

== Online Presence (Month 1)

=== Google Business Profile (Essential)
#indent[
  This is how people find local contractors, and it's completely free.

  + Go to google.com/business
  + Claim or create your business
  + Add photos, services, hours
  + Ask customers to leave reviews
]

=== Website (Optional but Helpful)
#indent[
  A simple one-page website with your services, contact info, and photos of your work.

  - *Free AI option:* Ask ChatGPT or Claude to write your website copy
  - *Free builders:* Carrd.co, Google Sites, Wix (free tier)
]

== "Are You Licensed and Insured?"

You will get this question. Be ready with a confident answer:

#block(fill: rgb("#f0f0f0"), inset: 10pt, radius: 4pt)[
  _"Yes, I'm [licensed/registered] with [state/city] and I carry \$1 million in general liability insurance. I'm happy to provide a certificate of insurance before we start if you'd like."_
]

Have your insurance certificate ready to email. Most insurers let you generate COIs instantly online.

= Section 8: The 90-Day Action Plan

Here's exactly what to do in your first 90 days.

== Week 1-2: Foundation

#todo[Decide on business structure (LLC recommended)]
#todo[File LLC paperwork with your state]
#todo[Apply for EIN at IRS.gov]
#todo[Open business bank account]
#todo[Get insurance quotes from at least 3 providers]
#todo[Research your state's licensing requirements]
#celebrate[Celebrate: You officially have a business!]

== Week 3-4: Setup

#todo[Purchase general liability insurance]
#todo[Apply for contractor license (if required in your state)]
#todo[Apply for local business license]
#todo[Order business cards]
#todo[Create a simple logo]
#todo[Set up Google or Facebook Business Profile]
#todo[Organize your tools]
#celebrate[Celebrate: You're legal, insured, and ready to work!]

== Month 2: Launch

#todo[Tell everyone you know you're open for business]
#todo[Complete your first 3-5 jobs (friends, family, referrals)]
#todo[Take before/after photos of every job]
#todo[Ask satisfied customers for Google reviews]
#todo[Refine your pricing based on actual job costs]
#todo[Set up basic expense tracking (even a spreadsheet)]
#celebrate[Celebrate: You're officially a working contractor!]

== Month 3: Systems

#todo[Review your numbers: revenue, expenses, profit margin]
#todo[Follow up with past customers for referrals]
#todo[Create templates: quotes, invoices, contracts]
#todo[Start building emergency fund (goal: 1 month expenses)]
#todo[Identify what's working for customer acquisition]
#todo[Plan for months 4-6: where will customers come from?]
#celebrate[Celebrate: You made it 90 days. Most don't. You did.]

= Section 9: Lessons from Contractors Who've Been There

Every successful contractor picked up a few things along the way. Here's wisdom from those who came before you.

== Lesson \#1: Charge What You're Worth from Day One

*What some new contractors think:* "I'll charge less to get the work, then raise prices later."

*What experienced contractors know:* Your early clients set expectations. Price-shoppers will always leave for someone \$50 cheaper.

*The smart approach:* Calculate your true costs (labor + materials + overhead + profit) and price accordingly.

#v(0.1in)
#block(fill: rgb("#F0FDF4"), inset: 12pt, radius: 4pt, width: 100%)[
  #text(fill: rgb("#16A34A"), weight: "bold", size: 10pt)[FREE TOOL:] Use our Profit Margin Calculator to know what you can afford to spend before you bid: #link("https://quotecat.ai/resources/profit-margin-calculator")[#text(fill: rgb("#16A34A"), weight: "bold")[quotecat.ai/resources/profit-margin-calculator]]
]

== Lesson \#2: Put Everything in Writing

*What some new contractors think:* "We agreed on the phone, that's good enough."

*What experienced contractors know:* Memory is unreliable. Written quotes prevent 90% of disputes.

*The smart approach:* Even for small jobs, even for friends, send a simple written quote.

== Lesson \#3: Keep Business and Personal Money Separate

*What some new contractors think:* "I'll sort it out at tax time."

*What experienced contractors know:* You won't remember which gas station fill-up was for work 8 months later.

*The smart approach:* Open a business checking account in week one. Use it for ALL business expenses.

== Lesson \#4: It's Okay to Be Booked Out

*What some new contractors think:* "I can't say no to work!"

*What experienced contractors know:* Taking on too much leads to rushed work, mistakes, and burnout.

*The smart approach:* "I'm booked out 3 weeks, I can get you on the schedule then." This isn't a problem, it's a sign of a healthy business.

== Lesson \#5: Track Your Time and Costs

*What some new contractors think:* "I know how long things take."

*What experienced contractors know:* Most people underestimate. Tracking reveals the truth.

*The smart approach:* For your first 20 jobs, track hours and material costs. Then review: Did your estimates match reality?

#v(0.1in)
#block(fill: rgb("#F0FDF4"), inset: 12pt, radius: 4pt, width: 100%)[
  #text(fill: rgb("#16A34A"), weight: "bold", size: 10pt)[FREE TOOL:] Use our Markup Calculator to see exactly how much profit you're making on each job: #link("https://quotecat.ai/resources/markup-calculator")[#text(fill: rgb("#16A34A"), weight: "bold")[quotecat.ai/resources/markup-calculator]]
]

// ===== FINAL PAGE =====

#align(center)[
  #v(0.6in)
  #text(fill: rgb("#F97316"), size: 22pt, weight: "bold")[You're Ready.]
  #v(0.2in)
  #text(size: 11pt)[You have the checklist. You know what it takes. Now it's time to build.]
  #v(0.4in)

  #block(fill: rgb("#f0f0f0"), inset: 16pt, radius: 6pt, width: 85%)[
    *Next Steps:*

    #v(0.15in)

    *1. Start sending professional quotes*

    Try QuoteCat Free - create quotes and invoices, send professional PDFs, and see how easy it can be. No credit card required.

    → #link("https://quotecat.ai")[#text(fill: rgb("#F97316"), weight: "bold")[quotecat.ai]]

    #v(0.15in)

    *2. Use our free calculators*

    Figure out your hourly rate and understand markup vs margin with our free online tools.

    → #link("https://quotecat.ai/resources")[#text(fill: rgb("#F97316"), weight: "bold")[quotecat.ai/resources]] (Free)

    #v(0.15in)

    *3. Master your pricing*

    The Contractor Pricing Guide teaches you how to price jobs profitably and stop leaving money on the table.

    → #link("https://quotecat.ai/pricing-guide")[#text(fill: rgb("#F97316"), weight: "bold")[quotecat.ai/pricing-guide]] (\$29)
  ]

  #v(0.4in)
  #line(length: 30%, stroke: 1pt + rgb("#F97316"))
  #v(0.25in)

  *About QuoteCat*

  #text(size: 9pt)[QuoteCat helps contractors quote faster, win more jobs, and get paid. Quotes, invoices, contracts, real supplier pricing, and an AI assistant that helps you build quotes on the fly.]

  #v(0.25in)
  #link("https://quotecat.ai")[#text(fill: rgb("#F97316"), size: 12pt, weight: "bold")[quotecat.ai]]

  #v(0.3in)
  #text(fill: rgb("#888888"), size: 8pt)[© 2026 QuoteCat. All rights reserved.]
]

// QuoteCat Startup Kit - Typst Document
// Brand colors: Orange #F97316, Dark #0a0a0a, White #f5f5f5

#set page(
  paper: "us-letter",
  margin: (x: 0.75in, y: 0.75in),
  fill: rgb("#1a1a1a"),
  header: align(right)[
    #text(fill: rgb("#666666"), size: 9pt)[https://quotecat.ai]
  ],
  footer: align(center)[
    #text(fill: rgb("#666666"), size: 9pt)[
      © 2026 QuoteCat. All rights reserved. | #counter(page).display()
    ]
  ]
)

#set text(
  font: "Helvetica Neue",
  fill: rgb("#f5f5f5"),
  size: 10pt
)

#set heading(numbering: none)

#show heading.where(level: 1): it => {
  v(0.3in)
  block(
    width: 100%,
    fill: rgb("#F97316"),
    inset: (x: 12pt, y: 10pt),
    radius: 4pt,
    text(fill: rgb("#000000"), weight: "bold", size: 16pt)[#it.body]
  )
  v(0.15in)
}

#show heading.where(level: 2): it => {
  v(0.15in)
  text(fill: rgb("#F97316"), weight: "bold", size: 13pt)[#it.body]
  v(0.1in)
}

#show heading.where(level: 3): it => {
  v(0.1in)
  text(fill: rgb("#f5f5f5"), weight: "bold", size: 11pt)[#it.body]
  v(0.05in)
}

#show link: it => {
  text(fill: rgb("#F97316"))[#it]
}

// Custom checkbox function
#let checkbox(checked: false) = {
  if checked {
    box(stroke: 1pt + rgb("#F97316"), fill: rgb("#F97316"), width: 10pt, height: 10pt, radius: 2pt)[
      #align(center + horizon)[#text(fill: white, size: 8pt)[✓]]
    ]
  } else {
    box(stroke: 1pt + rgb("#F97316"), width: 10pt, height: 10pt, radius: 2pt)
  }
}

#let todo(content) = {
  grid(
    columns: (14pt, 1fr),
    gutter: 6pt,
    checkbox(),
    content
  )
}

// Title Page
#align(center)[
  #v(1in)
  #image("../assets/images/qc-logo-large-white-tpnt.png", width: 2in)
  #v(0.3in)
  #text(fill: rgb("#F97316"), size: 28pt, weight: "bold")[The Contractor Startup Kit]
  #v(0.1in)
  #text(fill: rgb("#f5f5f5"), size: 16pt)[Your First 90 Days]
  #v(0.3in)
  #line(length: 50%, stroke: 1pt + rgb("#F97316"))
  #v(0.2in)
  #text(fill: rgb("#a0a0a0"), size: 11pt)[The No-BS Checklist for Starting Your Contracting Business the Right Way]
  #v(1in)
  #text(fill: rgb("#666666"), size: 10pt)[https://quotecat.ai]
]

#pagebreak()

// Content starts here
= Section 1: You Can Do This (Here's How to Do It Right)

You've got the skills. You've put in the years. Now you're ready to build something of your own.

Starting a contracting business is one of the most rewarding paths you can take. You set your schedule, choose your customers, and build real wealth, not just a paycheck. Thousands of skilled tradespeople make this leap every year and thrive.

*Here's the truth: most new businesses succeed.*

According to the U.S. Bureau of Labor Statistics, *80% of new businesses survive their first year.* The contractors who make it aren't necessarily more talented, they're just more prepared. And that's exactly what this guide is for.

#text(fill: rgb("#666666"), size: 9pt, style: "italic")[Source: U.S. Bureau of Labor Statistics, Business Employment Dynamics (2024)]

You're already ahead of most people just by reading this. Let's make sure you're set up for success.

== The One Thing That Trips People Up: Cash Flow

Here's something experienced contractors wish someone had told them earlier: you can stay busy and still struggle financially if you don't manage your cash flow.

A U.S. Bank study found that cash flow challenges are behind most business struggles, not lack of work or skill. The good news? It's completely manageable once you understand it.

In construction, getting paid can take 60-90 days. That's normal. The key is planning for it: get deposits upfront, invoice immediately, and keep a cash cushion. (We'll cover exactly how in *Section 4*.)

#text(fill: rgb("#666666"), size: 9pt, style: "italic")[Source: U.S. Bank Small Business Study]

== Quick Gut Check: Where Do You Stand?

This isn't a test, it's a tool to help you see where you're strong and where you might want to shore things up.

Check the boxes that apply:

#todo[I have *some financial runway* saved up (or a working spouse/partner who can cover bills while I ramp up)]
#todo[I'm *confident in my trade skills* (journeyman level or solid real-world experience)]
#todo[I have a sense of *what I'll charge* (or I'm ready to figure it out, Section 6 will help with this)]
#todo[I know *a few people who'd hire me* to get started (friends, family, former coworkers)]
#todo[I can handle *some income uncertainty* while I build momentum]
#todo[I've thought about *what I'd do* if I needed to pivot]

*What your answers tell you:*
- *5-6 checked:* You're in great shape. Go for it with confidence.
- *3-4 checked:* Solid foundation. Consider the side hustle approach to reduce risk while you build.
- *0-2 checked:* You can absolutely still do this, just give yourself more runway. The side hustle path was made for you.

#pagebreak()

== Side Hustle vs. Cold Start

There are two paths to starting your contracting business:

=== The Side Hustle Path

Keep your day job. Build customers on weekends and evenings. Transition to full-time when revenue is consistent.

*Timeline:* 12-24 months (typical)

*Pros:*
- Lower financial risk
- Time to learn the business side while still getting a paycheck
- Build customer base before you need it

*Cons:*
- Slower growth
- Less availability = fewer job opportunities
- Exhausting to work two jobs

*Best for:* People with limited savings, those who need health insurance, first-time business owners.

=== The Cold Start Path

Quit your job. Go all-in from day one with runway saved.

*Timeline:* Consider having 6-12 months of personal expenses saved (minimum)

*Pros:*
- Full focus on building the business
- More availability = more job opportunities
- Faster growth potential

*Cons:*
- Higher financial risk
- Stress of no steady income
- No safety net if it doesn't work

*Best for:* People with more savings, an existing customer base, or a working spouse/partner.

=== The Anchor Client Strategy

The smartest approach: find one client who can provide 50%+ of your income before you quit.

This might be:
- A general contractor who needs a reliable sub
- A property manager with regular maintenance needs
- A business owner who needs ongoing work

An anchor client gives you some income stability AND time to build the rest of your business.

#pagebreak()

== Runway Calculator

How much do you need saved before going full-time?

#table(
  columns: (1fr, 1fr, 1fr),
  fill: (col, row) => if row == 0 { rgb("#F97316") } else if calc.odd(row) { rgb("#2a2a2a") } else { rgb("#1a1a1a") },
  inset: 8pt,
  [*Monthly Expenses*], [*6 Months (Minimum)*], [*12 Months (Recommended)*],
  [\$3,000], [\$18,000], [\$36,000],
  [\$4,000], [\$24,000], [\$48,000],
  [\$5,000], [\$30,000], [\$60,000],
  [\$6,000], [\$36,000], [\$72,000],
)

*Add 20% buffer* for unexpected costs (equipment breaks, slow month, emergency).

#text(fill: rgb("#666666"), size: 9pt, style: "italic")[This is personal expenses only. Business startup costs are separate.]

#pagebreak()

= Section 2: Legal Setup Checklist

Get the paperwork right from day one. It's not as hard as you think.

== Business Structure (Do This First)

You have three main options:

=== Sole Proprietorship
- *Simplest option* - No special paperwork beyond a business license
- *Cost:* \$0-\$50 depending on local requirements
- *Consideration:* No separation between you and your business legally, an LLC provides more protection

=== LLC (Limited Liability Company)
- *Recommended for most contractors*
- *Cost:* \$50-\$500 depending on state (one-time filing fee)
- *Benefit:* Protects your personal assets (house, car, savings) from business liabilities
- *Tax treatment:* "Pass-through" - business income goes on your personal taxes

=== S-Corporation
- *Consider once you're making \$75K+ profit*
- *Cost:* More expensive to set up and maintain (\$500-\$2,000+ annually for accounting)
- *Benefit:* Potential tax savings through salary/dividend split
- *Downside:* More paperwork, need to pay yourself a "reasonable salary"

*Recommendation:* Start as an LLC. The \$100-\$300 filing fee is worth it for the protection. You can always convert to S-Corp later when you're making more money.

#text(fill: rgb("#666666"), size: 9pt, style: "italic")[Consult an accountant before choosing your structure, they can advise based on your specific situation.]

== Federal Requirements

=== EIN (Employer Identification Number)
- *What it is:* A tax ID number for your business (like a Social Security number)
- *Cost:* Free
- *How to get it:* IRS.gov → Apply Online → Takes 5 minutes
- *Why you need it:* Required for business bank accounts, hiring employees, and looks more professional than giving out your SSN

#pagebreak()

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

#pagebreak()

= Section 3: Insurance Checklist

Insurance is one of the best investments you'll make. It protects your business, your personal assets, and gives customers confidence in hiring you.

Most clients expect proof of insurance before hiring a contractor, having it ready puts you ahead of the competition.

== Required: General Liability Insurance

- *What it covers:* Property damage, bodily injury, personal injury claims arising from your work.
- *Coverage amount:* \$1 million per occurrence / \$2 million aggregate (standard minimum)
- *Typical cost:* \$82-\$150/month depending on trade and location
- *Who requires it:* Almost every client, general contractor, and property manager.

#text(fill: rgb("#666666"), size: 9pt, style: "italic")[Source: MoneyGeek Contractor Insurance Report (2026); Insureon]

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

#pagebreak()

= Section 4: Money Setup

*Master this section and you'll be ahead of most contractors.*

Cash flow is the \#1 thing that keeps contractors thriving. The good news? It's not complicated once you understand it.

In construction, payment cycles are longer than most industries, sometimes 60-90 days. That's just how the industry works. The contractors who succeed are the ones who plan for it.

== Bank Accounts (A Great First Step)

=== Business Checking Account
*Why:* Keep business money completely separate from personal money.

*Why this matters:*
- Keeping things separate makes bookkeeping SO much easier
- Tax time becomes simple instead of stressful
- You'll always know exactly how your business is doing
- It looks professional if you ever need a loan or get audited

*How to open:* Bring your EIN, LLC documents, and ID to any bank. Many offer free business checking.

=== Business Savings Account
*Why:* Set aside money for taxes and emergencies.

*Rule of thumb:* Transfer 25-30% of every payment you receive into savings for taxes. You'll thank yourself when tax time comes.

== The Cash Flow Mindset

*Invoice the same day you finish.* The sooner you send it, the sooner you get paid. Make it a habit.

*Follow up on overdue invoices.* A friendly check-in 3-5 days after the due date usually does the trick.

*Protect your time.* If a client hasn't paid for job \#1, it's okay to wait before starting job \#2 for them.

*Use payment milestones on bigger jobs.* For larger projects, bill at stages (rough-in, drywall, finish, final) so you're not waiting until the end to get paid.

#pagebreak()

= Section 5: Tools & Equipment (Minimum Viable Kit)

You don't need everything on day one. Here's what you actually need to start.

*The mindset:*
- Start lean. Buy quality basics, rent specialty tools.
- Used commercial equipment is often better than new consumer-grade.
- Your truck is a tool. It doesn't need to be new.

== Starter Kit by Trade

=== Electrician (\$3,000-\$8,000)

*Essential tools:*
#todo[Quality multimeter (\$100-\$300)]
#todo[Wire stripper/cutter set (\$150-\$300)]
#todo[Fish tape and pull rods (\$100-\$200)]
#todo[Drill and impact driver (\$200-\$400)]
#todo[Voltage tester, circuit tracer (\$100-\$250)]
#todo[Tool bag/box, hand tools (\$200-\$400)]
#todo[Safety gear: gloves, glasses, hard hat (\$100-\$200)]
#todo[Basic inventory: wire nuts, connectors, common breakers (\$500-\$1,000)]

=== Plumber (\$5,000-\$12,000)

*Essential tools:*
#todo[Pipe wrench set (3-4 sizes) (\$200-\$400)]
#todo[Tubing cutter, pipe cutter (\$100-\$200)]
#todo[Drain snake/auger (\$200-\$500)]
#todo[Propane torch, solder kit (\$100-\$200)]
#todo[PEX tools (crimper, cutter) (\$200-\$400)]
#todo[Drill with hole saws (\$300-\$500)]
#todo[Basic inspection camera (\$200-\$500)]
#todo[Initial inventory: fittings, valves, common parts (\$1,000-\$2,000)]

=== Painter (\$500-\$2,000)

*Essential tools:*
#todo[Quality brushes, rollers, extension poles (\$100-\$200)]
#todo[Drop cloths, tape, plastic sheeting (\$50-\$100)]
#todo[5-gallon buckets, mixing tools (\$30-\$50)]
#todo[Step ladder (6-8 ft) (\$100-\$150)]
#todo[Caulk gun, putty knives, scrapers (\$50-\$100)]
#todo[Optional: Airless sprayer (\$300-\$1,500) - rent until volume justifies]

#pagebreak()

= Section 6: Your First 10 Customers

You don't need a marketing budget. You need 10 people who trust you.

== The Friends & Family Launch

Your first 5-10 jobs will likely come from people who already know you. That's not cheating, that's smart business.

*Action steps:*
+ Make a list of everyone you know who owns a home or business
+ Tell them you're starting your contracting business
+ Ask: "Do you know anyone who needs [electrical/plumbing/HVAC/etc.] work?"
+ Optional: Offer a "friends and family" rate for your first few jobs

*Tip:* Even for friends and family, charge something. It values your skills and sets healthy expectations from the start.

== Building Reputation from Day One

#todo[Take before/after photos of every job (you'll need these for marketing)]
#todo[Ask happy customers for Google reviews (87% of people read reviews before hiring)]
#todo[Create a Google Business Profile (free, essential)]
#todo[Respond to every review, even negative ones (shows you care)]

*The best referrals happen without asking.* Do great work, leave the jobsite cleaner than you found it, and be easy to work with. Happy customers tell their friends.

When someone loves their new deck, they show it off. When their lights finally work right, they tell the neighbor who's been complaining about theirs. The outcome sells the next job.

Leave a few business cards behind, send a quick "thanks" text, and move on.

The rest happens naturally.

#pagebreak()

= Section 7: Looking Professional (Day One)

Looking professional is easier than you think. You don't need a fancy brand to look professional. Here's what actually matters on day one.

== Identity Basics (Week 1)

=== Business Cards
Yes, they still matter. When you meet someone on a job site or at the hardware store, you need something to hand them.

- *Where to get them:* Vistaprint, Canva Print
- *Cost:* \$20-\$40 for 500 cards
- *What to include:* Name, trade, phone, email, license number (if applicable)

=== Simple Logo
You don't need to spend \$500 on a designer. You need something clean and readable.

- *Free AI option:* ChatGPT, Claude, or other AI tools can generate a solid logo in minutes
- *DIY option:* Canva.com (also free) - use a template
- *Budget option:* Fiverr (\$20-\$50)
- *Keep it simple:* Your company name in a clean font, maybe one icon

== "Are You Licensed and Insured?"

You will get this question. Be ready with a confident answer:

#block(
  fill: rgb("#2a2a2a"),
  inset: 12pt,
  radius: 4pt,
)[
  _"Yes, I'm [licensed/registered] with [state/city] and I carry \$1 million in general liability insurance. I'm happy to provide a certificate of insurance before we start if you'd like."_
]

Have your insurance certificate ready to email. Most insurers let you generate COIs instantly online. It takes 2 minutes and builds instant trust.

#pagebreak()

= Section 8: The 90-Day Action Plan

Here's exactly what to do in your first 90 days.

== Week 1-2: Foundation

#todo[Decide on business structure (LLC recommended)]
#todo[File LLC paperwork with your state]
#todo[Apply for EIN at IRS.gov]
#todo[Open business bank account]
#todo[Get insurance quotes from at least 3 providers]
#todo[Research your state's licensing requirements]
#box(fill: rgb("#F97316"), inset: 6pt, radius: 4pt)[*Celebrate: You officially have a business!*]

== Week 3-4: Setup

#todo[Purchase general liability insurance]
#todo[Apply for contractor license (if required in your state)]
#todo[Apply for local business license]
#todo[Order business cards]
#todo[Create a simple logo]
#todo[Set up Google or Facebook Business Profile]
#todo[Organize your tools]
#box(fill: rgb("#F97316"), inset: 6pt, radius: 4pt)[*Celebrate: You're legal, insured, and ready to work!*]

== Month 2: Launch

#todo[Tell everyone you know you're open for business]
#todo[Complete your first 3-5 jobs (friends, family, referrals)]
#todo[Take before/after photos of every job]
#todo[Ask satisfied customers for Google reviews]
#todo[Refine your pricing based on actual job costs]
#todo[Set up basic expense tracking (even a spreadsheet)]
#box(fill: rgb("#F97316"), inset: 6pt, radius: 4pt)[*Celebrate: You're officially a working contractor!*]

== Month 3: Systems

#todo[Review your numbers: revenue, expenses, profit margin]
#todo[Follow up with past customers for referrals]
#todo[Create templates: quotes, invoices, contracts]
#todo[Start building emergency fund (goal: 1 month expenses)]
#todo[Identify what's working for customer acquisition]
#todo[Plan for months 4-6: where will customers come from?]
#box(fill: rgb("#F97316"), inset: 6pt, radius: 4pt)[*Celebrate: You made it 90 days. Most don't. You did.*]

#pagebreak()

= Section 9: Lessons from Contractors Who've Been There

Every successful contractor picked up a few things along the way. Here's wisdom from those who came before you, so you can get there faster.

== Lesson \#1: Charge What You're Worth from Day One

*What some new contractors think:* "I'll charge less to get the work, then raise prices later."

*What experienced contractors know:* Your early clients set expectations. Price-shoppers will always leave for someone \$50 cheaper, they were never loyal customers anyway.

*The smart approach:* Calculate your true costs (labor + materials + overhead + profit) and price accordingly. The right clients will pay for quality work.

== Lesson \#2: Put Everything in Writing

*What some new contractors think:* "We agreed on the phone, that's good enough."

*What experienced contractors know:* Memory is unreliable, for you AND the customer. Written quotes prevent 90% of disputes before they happen.

*The smart approach:* Even for small jobs, even for friends, send a simple written quote. "Install ceiling fan in master bedroom - \$275, includes labor and materials." It takes 2 minutes and protects everyone.

== Lesson \#3: Keep Business and Personal Money Separate

*What some new contractors think:* "I'll sort it out at tax time."

*What experienced contractors know:* You won't remember which gas station fill-up was for work 8 months later. Separate accounts make tax time simple.

*The smart approach:* Open a business checking account in week one. Use it for ALL business expenses. Keep personal spending completely separate.

== Lesson \#4: It's Okay to Be Booked Out

*What some new contractors think:* "I can't say no to work!"

*What experienced contractors know:* Taking on too much leads to rushed work, mistakes, and burnout. Quality suffers, and so does your reputation.

*The smart approach:* "I'm booked out 3 weeks, I can get you on the schedule then." This isn't a problem, it's a sign of a healthy business.

#pagebreak()

#align(center)[
  #v(1in)
  #text(fill: rgb("#F97316"), size: 24pt, weight: "bold")[You're Ready.]
  #v(0.3in)
  #text(size: 12pt)[You have the checklist. You know what it takes. Now it's time to build.]
  #v(0.5in)

  #block(
    fill: rgb("#2a2a2a"),
    inset: 20pt,
    radius: 8pt,
    width: 80%,
  )[
    *Next Steps:*

    #v(0.2in)

    *1. Start sending professional quotes*

    Try QuoteCat Free - create quotes and invoices, send professional PDFs, and see how easy it can be. No credit card required.

    → *https://quotecat.ai*

    #v(0.2in)

    *2. Master your pricing*

    The Contractor Pricing Guide teaches you how to price jobs profitably, use the Good/Better/Best framework, and stop leaving money on the table.

    → *https://quotecat.ai/pricing-guide* (\$29)
  ]

  #v(0.5in)
  #line(length: 30%, stroke: 1pt + rgb("#F97316"))
  #v(0.3in)

  *About QuoteCat*

  QuoteCat helps contractors quote faster, win more jobs, and get paid. Quotes, invoices, contracts, real supplier pricing, and an AI assistant that helps you build quotes on the fly.

  #v(0.3in)
  #text(fill: rgb("#F97316"), size: 14pt, weight: "bold")[https://quotecat.ai]
]

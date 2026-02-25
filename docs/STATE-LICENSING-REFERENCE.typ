// QuoteCat State Licensing Reference - Styled to match Startup Kit
// Orange: #F97316 | Dark: #1a1a1a | White background

#set page(
  paper: "us-letter",
  margin: (x: 0.5in, y: 0.5in),
  fill: white,
  footer: context align(center)[
    #text(fill: rgb("#999999"), size: 8pt)[
      #counter(page).display() | quotecat.ai
    ]
  ]
)

#set text(font: "Helvetica Neue", fill: rgb("#1a1a1a"), size: 9pt, hyphenate: false)

#set par(leading: 0.65em, spacing: 1.2em, justify: false)

#show heading.where(level: 1): it => {
  v(0.2in)
  block(width: 100%, fill: rgb("#F97316"), inset: (x: 10pt, y: 8pt), radius: 3pt)[
    #text(fill: rgb("#000000"), weight: "bold", size: 13pt)[#it.body]
  ]
  v(0.12in)
}

#show heading.where(level: 2): it => {
  v(0.18in)
  text(fill: rgb("#F97316"), weight: "bold", size: 10.5pt)[#it.body]
  v(0.08in)
}

#show link: it => text(fill: rgb("#F97316"))[#it]

#let source(content) = {
  text(fill: rgb("#555555"), size: 8pt, style: "italic")[#content]
}

// ===== TITLE PAGE =====
#page(margin: 0pt, footer: none)[
  // Orange header band
  #box(
    width: 100%,
    height: 2in,
    fill: rgb("#F97316"),
  )[
    #align(center + horizon)[
      #box(
        fill: white,
        radius: 50%,
        inset: 15pt,
      )[
        #image("../assets/images/qc-logo-large-white-tpnt.png", width: 0.9in)
      ]
    ]
  ]

  // Content area
  #v(0.5in)
  #align(center)[
    #text(fill: rgb("#1a1a1a"), size: 28pt, weight: "bold", tracking: -0.5pt)[State Contractor Licensing]
    #v(0.08in)
    #text(fill: rgb("#F97316"), size: 28pt, weight: "bold", tracking: -0.5pt)[Quick Reference]
    #v(0.25in)
    #box(width: 2.5in, height: 3pt, fill: rgb("#F97316"))
    #v(0.25in)
    #text(fill: rgb("#555555"), size: 11pt)[A companion to The 90-Day Contractor Startup Kit]
    #v(1in)
    #text(fill: rgb("#F97316"), weight: "bold", size: 11pt)[quotecat.ai]
  ]
]

// ===== CONTENT =====

= How to Use This Table

- *License Required:* Does the state require a statewide contractor license?
- *Threshold:* Minimum project value that triggers licensing requirement
- *Bond Required:* Does the state require a surety bond?
- *Notes:* Important details for that state

*Always verify with your state's licensing board* - requirements change, and local jurisdictions may have additional rules.

= 50-State Licensing Requirements

#set text(size: 7.5pt)

#table(
  columns: (1fr, 0.7fr, 0.8fr, 0.7fr, 1.3fr),
  fill: (_, row) => if row == 0 { rgb("#F97316") } else if calc.odd(row) { rgb("#f5f5f5") } else { white },
  inset: 4pt,
  [*State*], [*License?*], [*Threshold*], [*Bond?*], [*Notes*],
  [Alabama], [Yes], [>\$50,000], [Yes], [Lower threshold some trades],
  [Alaska], [Yes], [All work], [Yes], [Endorsement for specialties],
  [Arizona], [Yes], [All work], [Yes], [ROC license required],
  [Arkansas], [Yes], [>\$50,000], [Yes], [Residential only at state],
  [California], [Yes], [>\$500], [Yes \$25K], [Strictest in nation],
  [Colorado], [No], [Check local], [Varies], [Denver, Boulder require],
  [Connecticut], [Yes], [All work], [No], [HIC registration required],
  [Delaware], [No], [Check local], [Varies], [Local licenses may apply],
  [Florida], [Yes], [All work], [Yes], [State or local required],
  [Georgia], [Yes], [>\$2,500], [Yes \$25K], [Residential & commercial],
  [Hawaii], [Yes], [All work], [Yes], [Must pass exam],
  [Idaho], [No], [Check local], [Varies], [Public works require reg],
  [Illinois], [No], [Check local], [Varies], [Chicago requires license],
  [Indiana], [No], [Check local], [Varies], [Trade licenses at state],
  [Iowa], [No], [Check local], [Varies], [Registration some trades],
  [Kansas], [No], [Check local], [Varies], [Local jurisdictions vary],
  [Kentucky], [No], [Check local], [Varies], [Trade licenses required],
  [Louisiana], [Yes], [>\$50,000], [Yes], [Residential & commercial],
  [Maine], [No], [Check local], [Varies], [Some trades require],
  [Maryland], [Yes], [All work], [No], [MHIC license required],
  [Massachusetts], [Yes], [All work], [No], [CSL and HIC registration],
  [Michigan], [Yes], [>\$600], [No], [Residential builders],
  [Minnesota], [Yes], [All work], [No], [Residential only],
  [Mississippi], [Yes], [>\$50,000], [Yes], [Residential contractors],
  [Missouri], [No], [Check local], [Varies], [KC, St. Louis require],
  [Montana], [No], [Check local], [Varies], [Registration required],
  [Nebraska], [No], [Check local], [Varies], [Registration required],
  [Nevada], [Yes], [All work], [Yes], [Strict requirements],
  [New Hampshire], [No], [Check local], [Varies], [Trade licenses only],
  [New Jersey], [Yes], [All work], [No], [HIC registration required],
  [New Mexico], [Yes], [All work], [Yes], [GB-2 or GB-98 license],
  [New York], [No], [NYC requires], [Varies], [NYC strict requirements],
  [North Carolina], [Yes], [>\$30,000], [No], [General contractors],
  [North Dakota], [Yes], [All work], [Yes], [Class A, B, C, D],
  [Ohio], [No], [Check local], [Varies], [Many cities require],
  [Oklahoma], [No], [Check local], [Varies], [Trade licenses at state],
  [Oregon], [Yes], [All work], [Yes \$20K], [CCB license required],
  [Pennsylvania], [No], [Check local], [Varies], [Philly, Pittsburgh require],
  [Rhode Island], [Yes], [All work], [No], [Registration required],
  [South Carolina], [Yes], [All work], [No], [Residential builders],
  [South Dakota], [No], [Check local], [Varies], [Excise tax license only],
  [Tennessee], [Yes], [>\$25,000], [Yes], [Home improvement],
  [Texas], [No], [Trade only], [Varies], [HVAC, elec, plumb licensed],
  [Utah], [Yes], [All work], [No], [DOPL license required],
  [Vermont], [No], [Check local], [Varies], [Registration required],
  [Virginia], [Yes], [>\$1,000], [No], [Class A, B, C licenses],
  [Washington], [Yes], [All work], [Yes], [L&I registration required],
  [West Virginia], [Yes], [All work], [Yes], [WV license required],
  [Wisconsin], [No], [Check local], [Varies], [Dwelling contractor cred],
  [Wyoming], [No], [Check local], [Varies], [Sales tax license only],
)

#set text(size: 9pt)

= Trade-Specific Licenses

These trades typically require a separate license regardless of general contractor requirements:

#table(
  columns: (1fr, 2fr),
  fill: (_, row) => if row == 0 { rgb("#F97316") } else if calc.odd(row) { rgb("#f5f5f5") } else { white },
  inset: 6pt,
  [*Trade*], [*Typical Requirement*],
  [Electrician], [Journeyman or Master license],
  [Plumber], [Journeyman or Master license],
  [HVAC], [EPA 608 certification + state license],
  [Roofing], [Often separate license required],
  [Fire Protection], [State license usually required],
)

= Next Steps

+ Search "[your state] contractor license requirements"
+ Visit your state's contractor licensing board website
+ Call your local building department
+ Check if your city/county has additional requirements

#v(0.3in)
#source[Sources: Procore Contractor License Guide; Harbor Compliance; NASCLA; Individual state licensing boards (2025-2026)]

#v(0.5in)
#align(center)[
  #line(length: 30%, stroke: 1pt + rgb("#F97316"))
  #v(0.2in)
  #text(fill: rgb("#555555"), size: 9pt)[This reference is part of The 90-Day Contractor Startup Kit from QuoteCat.]
  #v(0.15in)
  #text(fill: rgb("#F97316"), weight: "bold", size: 11pt)[quotecat.ai]
  #v(0.2in)
  #text(fill: rgb("#888888"), size: 8pt)[© 2026 QuoteCat. All rights reserved.]
]

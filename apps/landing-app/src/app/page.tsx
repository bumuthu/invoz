import Bridge from "@/components/Bridge";
import Header from "@/components/Header";
import Icon from "@/components/Icon";

const systems = [
  "SAP S/4HANA",
  "SAP Business One",
  "IFS",
  "Microsoft Dynamics",
  "Oracle",
  "Odoo",
];

const risks = [
  {
    title: "Immutability",
    body: "An accepted invoice cannot be edited or deleted. A correction is a tax credit note or debit note linked to the original clearance.",
  },
  {
    title: "The serial",
    body: "Gazette Extraordinary No. 2481/22 requires YYMMM_QQQQ_XXXXX. Each branch keeps its own sequence, and the sequence restarts each month.",
  },
  {
    title: "The sanction",
    body: "The VAT Amendment Act allows a fine of up to LKR 1,000,000 and imprisonment of up to six months for inaccurate records.",
  },
  {
    title: "The gateway",
    body: "IRD endpoints pause. A queue holds the invoice, retries with backoff, and keeps dispatch and checkout moving.",
  },
];

const steps = [
  {
    title: "Ingest",
    body: "The ERP drops a finished CSV over SFTP, or a cloud ERP posts the invoice to the webhook.",
  },
  {
    title: "Check",
    body: "Nine-digit TINs, separate invoice and supply dates, the CBSL rate for foreign amounts, and VAT that agrees to the total.",
  },
  {
    title: "Number",
    body: "The branch sequence is allocated, then the payload goes to RAMIS over mutual TLS.",
  },
  {
    title: "Return",
    body: "A clearance writes an acknowledgment the ERP can read. A rejection comes back in plain language for the billing desk.",
  },
];

const features = [
  {
    icon: "serial" as const,
    title: "Gazette serials",
    body: "Each branch of a legal entity has its own monthly lane. Colombo and Kandy can both issue 00041 in October, as 26OCT_CMB_00041 and 26OCT_KDY_00041.",
  },
  {
    icon: "check" as const,
    title: "Pre-flight checks",
    body: "Seller and buyer TINs, supply dates, currency conversion, and line math are verified before anything is submitted.",
  },
  {
    icon: "ingest" as const,
    title: "File drop or webhook",
    body: "Map the export columns once per legal entity. Older on-premise software can use a folder watcher. Half-written files are ignored.",
  },
  {
    icon: "note" as const,
    title: "Credit and debit notes",
    body: "Schedule 04 adjustments reference the original clearance identifier. The accepted invoice stays as it was filed.",
  },
  {
    icon: "match" as const,
    title: "Inward matching",
    body: "Schedule 02 records can be reviewed and approved in batches of up to 5,000, which keeps input VAT matched to the supplier invoice.",
  },
];

const sectors = [
  {
    name: "Tea auction brokers",
    when: "Since May 2026",
    body: "High-velocity consignment sales, broker commissions, and producer credit notes.",
  },
  {
    name: "Apparel exporters",
    when: "Phase 1 · Q3 2026",
    body: "Zero-rated export tracking and input VAT recovery after the end of SVAT.",
  },
  {
    name: "FMCG and wholesale",
    when: "End of 2026",
    body: "Multi-depot serials, and delivery returns posted as Schedule 04 credit notes.",
  },
  {
    name: "Financial services",
    when: "Phase 2",
    body: "The 20.5% financial-services rate across high volumes of recurring statements.",
  },
  {
    name: "Retail and hospitality",
    when: "2026–2027",
    body: "Secured point-of-sale fiscalization, with a buffer so the counter does not wait on the gateway.",
  },
];

const mandates = [
  {
    name: "Gazette Extraordinary No. 2481/22",
    when: "27 March 2026",
    body: "VAT tax-invoice content, nine-digit TINs, separate invoice and supply dates, and the serial format.",
  },
  {
    name: "Gazette Extraordinary No. 2500/106",
    when: "1 October 2026",
    body: "Moves the binding cutover from 1 July 2026 to 1 October 2026. The field rules stay the same.",
  },
  {
    name: "IRD Notice SEC/PN/VAT/2026-03",
    when: "4 May 2026",
    body: "Real-time Schedule 01 output and Schedule 04 adjustments through the RAMIS Web API.",
  },
  {
    name: "VAT (Amendment) Act No. 14 of 2026",
    when: "30 June 2026",
    body: "Reaffirms the LKR 60 million annual threshold and the sanctions for inaccurate invoices.",
  },
];

const plans = [
  {
    name: "Standard",
    price: "10,000",
    billing: "LKR 120,000 billed annually",
    featured: false,
    points: [
      "Up to 500 invoices a month",
      "LKR 10 overage per invoice",
      "Setup LKR 50,000–75,000",
      "Schedule 01 and the serial engine",
      "Email support",
    ],
  },
  {
    name: "Professional",
    price: "75,000",
    billing: "LKR 900,000 a year, or semi-annual",
    featured: true,
    points: [
      "Up to 5,000 invoices a month",
      "LKR 8 overage per invoice",
      "Setup LKR 250,000",
      "Schedule 01, 04, and 02 matching",
      "Multi-branch serial lanes",
      "Business-hours support",
    ],
  },
  {
    name: "Enterprise",
    price: "175,000",
    billing: "LKR 2,100,000 billed annually",
    featured: false,
    points: [
      "Up to 25,000 invoices a month",
      "LKR 5 overage per invoice",
      "Setup LKR 450,000",
      "Queued processing and an SLA",
      "Dedicated exception desk",
      "Priority support",
    ],
  },
];

export default function LandingHome() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-copy">
              <p className="eyebrow">ERP to government RAMIS</p>
              <h1 id="hero-title">
                The <span>Bridge</span> From Your ERP To RAMIS.
              </h1>
              <p className="lede">
                Each <span>e-invoice</span> moves from your ERP, through the product, into government RAMIS.
              </p>
            </div>
            <Bridge />
            <div className="hero-actions">
              <a className="btn btn-accent" href="#diagnostic">
                Request a diagnostic
              </a>
              <a className="btn btn-secondary" href="#pricing">
                See pricing
              </a>
            </div>
            <p className="hero-note">A typical connection is live in 48 hours. The diagnostic fee is credited toward the product.</p>
          </div>
        </section>

        <section className="rail" aria-label="Connected systems">
          <div className="container rail-row">
            <p>From the ERP</p>
            <ul>
              {systems.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="rail-to">into government RAMIS</p>
          </div>
        </section>

        <section className="section" aria-labelledby="risk-title">
          <div className="container">
            <header className="section-head">
              <p className="section-label">Exposure</p>
              <h2 id="risk-title">What a direct connection leaves on the desk.</h2>
            </header>
            <div className="risks">
              {risks.map((risk, index) => (
                <article className="risk rise" key={risk.title}>
                  <span className="risk-index">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{risk.title}</h3>
                  <p>{risk.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-alt" id="flow" aria-labelledby="flow-title">
          <div className="container">
            <header className="section-head">
              <p className="section-label">Clearance</p>
              <h2 id="flow-title">Four steps from post to acknowledgment.</h2>
              <p className="section-lead">
                The billing system stays in place. The middleware numbers, checks, and submits, then
                writes the result back for the ERP to read.
              </p>
            </header>
            <ol className="flow">
              {steps.map((step, index) => (
                <li className="flow-step rise" key={step.title}>
                  <span className="flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" id="product" aria-labelledby="product-title">
          <div className="container">
            <header className="section-head">
              <p className="section-label">Product</p>
              <h2 id="product-title">What the middleware holds.</h2>
            </header>
            <div className="features">
              {features.map((feature) => (
                <article className="feature rise" key={feature.title}>
                  <div className="feature-icon">
                    <Icon name={feature.icon} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-alt" id="sectors" aria-labelledby="sectors-title">
          <div className="container">
            <header className="section-head">
              <p className="section-label">Rollout</p>
              <h2 id="sectors-title">Built for the mandated sectors.</h2>
            </header>
            <div className="sectors">
              {sectors.map((sector) => (
                <article className="sector" key={sector.name}>
                  <h3>{sector.name}</h3>
                  <p className="sector-when">{sector.when}</p>
                  <p>{sector.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <div className="container">
            <header className="section-head">
              <p className="section-label">Pricing</p>
              <h2 id="pricing-title">Priced in rupees, for the whole group.</h2>
              <p className="section-lead">
                One subscription covers the organization. Invoices cleared by every legal entity count
                toward the same monthly allowance.
              </p>
            </header>
            <div className="plans">
              {plans.map((plan) => (
                <article className={plan.featured ? "plan plan-featured" : "plan"} key={plan.name}>
                  {plan.featured ? <p className="plan-flag">Most teams</p> : null}
                  <h3>{plan.name}</h3>
                  <p className="plan-price">
                    LKR {plan.price}
                    <span>per month</span>
                  </p>
                  <p className="plan-billing">{plan.billing}</p>
                  <ul>
                    {plan.points.map((point) => (
                      <li key={point}>
                        <Icon name="check" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <a className={plan.featured ? "btn btn-accent" : "btn btn-secondary"} href="#diagnostic">
                    Request a diagnostic
                  </a>
                </article>
              ))}
            </div>
            <p className="plan-footnote">
              Banks, leasing firms, and supermarket groups are quoted. Volumes above 50,000 invoices a
              month are contracted separately, from LKR 3.5 million a year.
            </p>
          </div>
        </section>

        <section className="section section-alt" id="mandate" aria-labelledby="mandate-title">
          <div className="container">
            <header className="section-head">
              <p className="section-label">Mandate</p>
              <h2 id="mandate-title">The instruments the format rests on.</h2>
            </header>
            <div className="mandates">
              {mandates.map((item) => (
                <article className="mandate" key={item.name}>
                  <h3>{item.name}</h3>
                  <p className="mandate-when">{item.when}</p>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section diagnostic" id="diagnostic" aria-labelledby="diagnostic-title">
          <div className="container diagnostic-grid">
            <div>
              <p className="section-label">Diagnostic</p>
              <h2 id="diagnostic-title">Three days against a sample export.</h2>
              <p className="lede">
                Send one billing file. The same pre-flight checks produce a two-page gap report:
                serial shape, missing supply dates, TIN length, and VAT rounding. The fee is credited
                in full toward implementation.
              </p>
              <ul className="prepare">
                <li>
                  <Icon name="check" />
                  <span>A finished invoice export, CSV or the file your ERP already writes.</span>
                </li>
                <li>
                  <Icon name="check" />
                  <span>Seller and buyer TINs, with invoice date and supply date in separate fields.</span>
                </li>
                <li>
                  <Icon name="check" />
                  <span>One credit note, if the desk issues them.</span>
                </li>
              </ul>
              <div className="diagnostic-actions">
                <a className="btn btn-accent" href="mailto:?subject=RAMIS%20Readiness%20Diagnostic">
                  Email a sample export
                </a>
                <a className="btn btn-on-dark" href="#pricing">
                  Compare plans
                </a>
              </div>
            </div>
            <aside className="receive" aria-label="What the report covers">
              <h3>The report names</h3>
              <ol>
                <li>Fields that miss Gazette 2481/22, including a supply date stored as the invoice date.</li>
                <li>Serials that will collide across branches, or that reset on the wrong boundary.</li>
                <li>Line totals whose VAT does not meet the grand total.</li>
              </ol>
            </aside>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-bar">
          <div>
            <p className="footer-brand">RAMIS Middleware</p>
            <p className="footer-copy">
              Compliance middleware for Sri Lankan VAT invoices. RAMIS is the Inland Revenue
              Department’s system. This product is an independent layer, and it is not an IRD service.
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="#product">Product</a>
            <a href="#flow">Clearance</a>
            <a href="#pricing">Pricing</a>
            <a href="#mandate">Mandate</a>
            <a href="#diagnostic">Diagnostic</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

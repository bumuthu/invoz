import type { Metadata } from "next";
import BookDemoButton from "@/components/BookDemoButton";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Icon from "@/components/Icon";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One subscription covers the organization. Plans are priced in rupees, from LKR 10,000 a month.",
};

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

export default function PricingPage() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="section pricing-page" aria-labelledby="pricing-title">
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
                  <BookDemoButton className={plan.featured ? "btn btn-accent" : "btn btn-secondary"}>
                    Book a demo
                  </BookDemoButton>
                </article>
              ))}
            </div>
            <p className="plan-footnote">
              Banks, leasing firms, and supermarket groups are quoted. Volumes above 50,000 invoices a
              month are contracted separately, from LKR 3.5 million a year.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

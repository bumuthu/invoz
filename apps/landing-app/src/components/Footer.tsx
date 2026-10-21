import BrandMark from "@/components/BrandMark";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-bar">
        <div>
          <a className="brand footer-brand" href="https://invoz.lk">
            <BrandMark />
            <span>Invoz</span>
          </a>
          <p className="footer-copy">
            Invoz carries Sri Lankan VAT e-invoices into government RAMIS. RAMIS is the Inland Revenue
            Department’s system. Invoz is an independent product at{" "}
            <a href="https://invoz.lk">invoz.lk</a>, and it is not an IRD service.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="/#product">Product</a>
          <a href="/#flow">Clearance</a>
          <a href="/pricing">Pricing</a>
          <a href="/#mandate">Mandate</a>
          <a href="/#diagnostic">Diagnostic</a>
        </nav>
      </div>
    </footer>
  );
}

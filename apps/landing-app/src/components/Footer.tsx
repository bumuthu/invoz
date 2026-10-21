export default function Footer() {
  return (
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

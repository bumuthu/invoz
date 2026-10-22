import ContactDetails from "@/components/ContactDetails";
import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-bar">
        <div>
          <a className="brand footer-brand" href="/" aria-label="Invoz">
            <Logo />
          </a>
          <p className="footer-copy">
            Invoz carries Sri Lankan VAT e-invoices into government RAMIS. RAMIS is the Inland Revenue
            Department’s system. Invoz is an independent product at{" "}
            <a href="https://invoz.lk">invoz.lk</a>, and it is not an IRD service.
          </p>
        </div>
        <ContactDetails className="footer-contact" />
      </div>
    </footer>
  );
}

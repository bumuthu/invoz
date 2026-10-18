import { isOrganizationSlug } from "@ramis/common";

const sampleHost = "raijam";

export default function LandingHome() {
  return (
    <main>
      <h1>RAMIS e-invoicing</h1>
      <p>Compliance middleware for Sri Lankan VAT invoices.</p>
      <p>
        Organization hosts use a slug such as {sampleHost}.
        {isOrganizationSlug(sampleHost) ? " This one is valid." : " This one is reserved."}
      </p>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RAMIS e-invoicing",
  description: "Compliance middleware for Sri Lankan VAT invoices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

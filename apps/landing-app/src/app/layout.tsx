import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import DemoProvider from "@/components/DemoProvider";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://invoz.lk"),
  title: {
    default: "Invoz",
    template: "%s · Invoz",
  },
  description:
    "Invoz carries e-invoices from SAP, IFS, Dynamics, Oracle, and Odoo into the government RAMIS e-invoice system.",
  applicationName: "Invoz",
  openGraph: {
    title: "Invoz",
    description:
      "Invoz carries e-invoices from SAP, IFS, Dynamics, Oracle, and Odoo into the government RAMIS e-invoice system.",
    url: "https://invoz.lk",
    siteName: "Invoz",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8FAFC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className={sans.className}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}

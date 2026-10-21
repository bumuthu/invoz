import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoz Admin",
  description: "Invoz platform admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

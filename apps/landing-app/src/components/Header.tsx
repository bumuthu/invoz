"use client";

import { useEffect, useState } from "react";
import BrandMark from "@/components/BrandMark";
import Icon from "@/components/Icon";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#flow", label: "Clearance" },
  { href: "/#mandate", label: "Mandate" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container header-bar">
        <a className="brand" href="/">
          <BrandMark />
          <span>Invoz</span>
        </a>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        <nav id="site-nav" className={open ? "site-nav is-open" : "site-nav"} aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a className="btn btn-accent nav-cta" href="/#diagnostic" onClick={() => setOpen(false)}>
            Request a diagnostic
          </a>
        </nav>
      </div>
    </header>
  );
}

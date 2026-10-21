"use client";

import { useState, type CSSProperties } from "react";

const erps = [
  "S/4HANA",
  "SAP ECC",
  "SAP B1",
  "IFS",
  "Dynamics",
  "Business Central",
  "Oracle",
  "NetSuite",
  "Odoo",
  "NAV",
];

function ErpLogo({ name }: { name: string }) {
  const word =
    name === "S/4HANA" || name === "SAP ECC" || name === "SAP B1"
      ? "SAP"
      : name === "IFS"
        ? "IFS"
        : name === "Odoo"
          ? "Odoo"
          : null;

  return (
    <span className="erp-logo" aria-hidden="true">
      {word}
      {(name === "Dynamics" || name === "Business Central" || name === "NAV") && (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <rect x="1" y="1" width="6" height="6" rx="1.2" />
          <rect x="9" y="1" width="6" height="6" rx="1.2" opacity="0.72" />
          <rect x="1" y="9" width="6" height="6" rx="1.2" opacity="0.72" />
          <rect x="9" y="9" width="6" height="6" rx="1.2" opacity="0.45" />
        </svg>
      )}
      {name === "Oracle" && (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.1" />
        </svg>
      )}
      {name === "NetSuite" && (
        <svg viewBox="0 0 16 16" width="15" height="15">
          <path d="M6.1 12.6h5.5a2.7 2.7 0 0 0 .4-5.4 3.4 3.4 0 0 0-6.4-.8 2.5 2.5 0 0 0 .5 6.2Z" />
        </svg>
      )}
    </span>
  );
}

export default function Bridge() {
  const [paused, setPaused] = useState(false);

  return (
    <figure className={paused ? "bridge is-paused" : "bridge"}>
      <div className="bridge-stage">
        <div className="cluster-wash" aria-hidden="true" />
        <svg className="bridge-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M14 20 C 37 20, 56 35, 60 50" />
          <path d="M32 15 C 46 15, 56 32, 60 50" />
          <path d="M50 26 C 55 26, 56 38, 60 50" />
          <path d="M16 40 C 38 40, 56 45, 60 50" />
          <path d="M34 42 C 47 42, 56 46, 60 50" />
          <path d="M12 58 C 36 58, 56 54, 60 50" />
          <path d="M28 58 C 44 58, 56 54, 60 50" />
          <path d="M22 76 C 41 76, 56 63, 60 50" />
          <path d="M44 72 C 52 72, 56 61, 60 50" />
          <path d="M54 88 C 57 88, 56 69, 60 50" />
          <path d="M60 50 H 86" />
        </svg>
        <p className="cluster-label">Your ERPs</p>
        <ul className="erp-cluster">
          {erps.map((name) => (
            <li className="erp" key={name}>
              <ErpLogo name={name} />
              <span className="erp-name">{name}</span>
            </li>
          ))}
        </ul>
        <div className="hub">
          <p className="bridge-kicker">The product</p>
          <p className="bridge-name">RAMIS Middleware</p>
        </div>
        <div className="dest">
          <p className="bridge-kicker">Government RAMIS</p>
          <p className="bridge-name">e-Invoice system</p>
        </div>
        <div className="envelopes" aria-hidden="true">
          {erps.map((name, index) => (
            <span className="envelope" key={name} style={{ "--i": index } as CSSProperties}>
              <svg viewBox="0 0 36 24" width="36" height="24">
                <rect x="0.75" y="0.75" width="34.5" height="22.5" rx="3" fill="#fff" stroke="currentColor" />
                <path d="M1.5 3.5 18 14.5 34.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
              </svg>
            </span>
          ))}
        </div>
      </div>
      <figcaption className="bridge-caption">
        <p>Each ERP sends its e-invoice into the product. From there it clears in government RAMIS.</p>
        <button
          type="button"
          className="bridge-control"
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Play flow" : "Pause flow"}
        </button>
      </figcaption>
    </figure>
  );
}

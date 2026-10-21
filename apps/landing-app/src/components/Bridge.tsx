"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

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

const curves = [
  "M14 20 C 37 20, 56 35, 60 50",
  "M32 15 C 46 15, 56 32, 60 50",
  "M50 26 C 55 26, 56 38, 60 50",
  "M16 40 C 38 40, 56 45, 60 50",
  "M34 42 C 47 42, 56 46, 60 50",
  "M12 58 C 36 58, 56 54, 60 50",
  "M28 58 C 44 58, 56 54, 60 50",
  "M22 76 C 41 76, 56 63, 60 50",
  "M44 72 C 52 72, 56 61, 60 50",
  "M54 88 C 57 88, 56 69, 60 50",
];

const GLIDE = 11000;

function progress(elapsed: number, index: number, hub: number, total: number) {
  const t = ((elapsed + index * 1100) % GLIDE) / GLIDE;
  if (t < 0.08) return { dist: 0, opacity: t / 0.08 };
  if (t < 0.42) return { dist: ((t - 0.08) / 0.34) * hub, opacity: 1 };
  if (t < 0.5) return { dist: hub, opacity: 1 };
  if (t < 0.9) return { dist: hub + ((t - 0.5) / 0.4) * (total - hub), opacity: 1 };
  return { dist: total, opacity: 1 - (t - 0.9) / 0.1 };
}

export default function Bridge() {
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const paths = [...stage.querySelectorAll<SVGPathElement>("path.route")];
    const nodes = [...stage.querySelectorAll<HTMLElement>(".envelope")];
    const wide = window.matchMedia("(min-width: 721px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hubLengths = paths.map((path) => {
      const probe = path.cloneNode() as SVGPathElement;
      probe.setAttribute("d", path.dataset.curve ?? "");
      return probe.getTotalLength();
    });

    const clear = () => {
      nodes.forEach((node) => {
        node.style.transform = "";
        node.style.opacity = "";
      });
    };

    const place = (elapsed: number, atStart: boolean) => {
      const box = stage.getBoundingClientRect();
      paths.forEach((path, index) => {
        const node = nodes[index];
        if (!node) return;
        const total = path.getTotalLength();
        const hub = Math.min(hubLengths[index] || 0, total);
        const point = atStart ? { dist: 0, opacity: 1 } : progress(elapsed, index, hub, total);
        const spot = path.getPointAtLength(point.dist);
        const matrix = path.getScreenCTM();
        if (!matrix) return;
        const screen = new DOMPoint(spot.x, spot.y).matrixTransform(matrix);
        node.style.transform = `translate3d(${screen.x - box.left - 18}px, ${screen.y - box.top - 12}px, 0)`;
        node.style.opacity = String(point.opacity);
      });
    };

    let frame = 0;
    let origin = performance.now();
    let pausedAt = 0;
    let held = 0;

    const stop = () => cancelAnimationFrame(frame);

    const loop = (now: number) => {
      if (!wide.matches) {
        clear();
        frame = requestAnimationFrame(loop);
        return;
      }
      if (reduced.matches) {
        place(0, true);
        frame = requestAnimationFrame(loop);
        return;
      }
      if (pausedRef.current) {
        if (!pausedAt) pausedAt = now;
      } else {
        if (pausedAt) {
          held += now - pausedAt;
          pausedAt = 0;
        }
        place(now - origin - held, false);
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => stop();
  }, []);

  return (
    <figure className={paused ? "bridge is-paused" : "bridge"}>
      <div className="bridge-stage" ref={stageRef}>
        <div className="cluster-wash" aria-hidden="true" />
        <svg className="bridge-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {curves.map((curve) => (
            <path className="route" key={curve} d={`${curve} H 86`} data-curve={curve} />
          ))}
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

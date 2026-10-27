"use client";

import Button from "@mui/material/Button";

export default function PrintButton() {
  return (
    <Button variant="contained" className="no-print" onClick={() => window.print()}>
      Print statement
    </Button>
  );
}

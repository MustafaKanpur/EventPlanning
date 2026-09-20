"use client";

import { useEffect } from "react";

/**
 * "Export run sheet" in the event header links here with ?print=1. Opening the print
 * dialog is the export: print styles drop the chrome, rail and controls, leaving the
 * timeline as a sheet someone can carry on the day.
 */
export function PrintTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

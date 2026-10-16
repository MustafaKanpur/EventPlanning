"use client";

import { useEffect, useState } from "react";

/**
 * App-wide loading bar. Page changes and server actions both reach the server through
 * window.fetch, so counting requests in flight catches every wait without any form or
 * link having to opt in. A finally block ends the wait even when a request fails.
 */
export function PendingBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const original = window.fetch;
    let inFlight = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    window.fetch = async (input, init) => {
      // Next preloads linked pages in the background; nobody is waiting on those.
      if (new Headers(init?.headers).has("Next-Router-Prefetch")) return original.call(window, input, init);

      // Waits under 150ms finish before the bar would show, so it doesn't flicker.
      if (inFlight++ === 0) timer = setTimeout(() => setVisible(true), 150);
      try {
        return await original.call(window, input, init);
      } finally {
        if (--inFlight === 0) {
          clearTimeout(timer);
          setVisible(false);
        }
      }
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      className="fixed inset-x-0 bottom-0 z-50 h-[3px] overflow-hidden bg-accent/20"
    >
      <div className="pending-bar-stripe h-full w-1/3 bg-accent" />
    </div>
  );
}

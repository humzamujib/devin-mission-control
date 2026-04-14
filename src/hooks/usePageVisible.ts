"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when the page is visible, false when the tab is hidden.
 * Polling loops should skip fetches (or pause intervals) when this is false
 * to avoid wasting API calls on a backgrounded tab.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    function handleChange() {
      setVisible(!document.hidden);
    }
    document.addEventListener("visibilitychange", handleChange);
    return () => document.removeEventListener("visibilitychange", handleChange);
  }, []);

  return visible;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dashboard } from "../services/dashboard";
import { api, errorText } from "./api";

const POLL_MS = 30_000;

/**
 * Loads the dashboard and refreshes it every 30 seconds while the tab is
 * visible. Polling keeps hosting simple: no sockets, no workers.
 */
export function useDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setData(await api<Dashboard>("/api/dashboard"));
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { data, error, refresh };
}

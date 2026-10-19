import { useSyncExternalStore } from "react";

/**
 * Live pathname hook for the app's minimal client-side routing
 * (no react-router dependency). Subscribes to pushState/replaceState
 * navigation + popstate so App.jsx re-renders without a full reload.
 */

function subscribe(callback) {
  window.addEventListener("popstate", callback);
  window.addEventListener("app:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("app:navigate", callback);
  };
}

function getSnapshot() {
  return window.location.pathname + window.location.search;
}

function getServerSnapshot() {
  return "/";
}

export function usePathname() {
  const full = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return full.split("?")[0];
}

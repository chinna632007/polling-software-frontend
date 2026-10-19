/**
 * Minimal client-side navigation helpers (no react-router dependency).
 *
 * App.jsx renders from usePathname() (see use-pathname.js), so a
 * pushState-only navigation re-renders without a full page reload.
 */

/** SPA navigation: pushState + notify subscribers (no page reload). */
export function navigate(href) {
  if (typeof window === "undefined") return;
  const current = window.location.pathname + window.location.search;
  if (current === href) return;
  window.history.pushState(null, "", href);
  window.dispatchEvent(new Event("app:navigate"));
}

/**
 * Click handler factory for internal links: SPA-navigate on plain
 * left-click, but let the browser handle Ctrl/Cmd-click, middle-click,
 * and "open in new tab" normally.
 */
export function spaClick(href) {
  return (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };
}

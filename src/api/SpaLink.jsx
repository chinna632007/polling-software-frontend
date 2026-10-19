import { spaClick } from "./router.jsx";

/**
 * Internal navigation link: renders a plain <a> (right-click / open-in-new-tab
 * keeps working) but SPA-navigates on a normal left-click so the app never
 * does a full page reload — which would 404 when the dev server or backend
 * isn't serving that route directly.
 *
 * Usage: <SpaLink className="..." href={href} aria-label="...">...</SpaLink>
 */
export function SpaLink({ href, children, ...rest }) {
  return (
    <a href={href} onClick={spaClick(href)} {...rest}>
      {children}
    </a>
  );
}

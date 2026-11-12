/**
 * Scrolls `container` so `el` is visible, keeping clear of sticky areas at the
 * top and left. Elements taller than the container are aligned to the top.
 */
export function ensureVisible(container: HTMLElement | null, el: HTMLElement | null, pad = { top: 0, left: 0, margin: 16 }) {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const viewTop = c.top + pad.top + pad.margin;
  const viewBottom = c.bottom - pad.margin;
  const viewLeft = c.left + pad.left;
  const viewRight = c.right;

  if (r.height > viewBottom - viewTop || r.top < viewTop) {
    container.scrollTop += r.top - viewTop;
  } else if (r.bottom > viewBottom) {
    container.scrollTop += r.bottom - viewBottom;
  }
  if (r.left < viewLeft) container.scrollLeft += r.left - viewLeft;
  else if (r.right > viewRight) container.scrollLeft += r.right - viewRight;
}

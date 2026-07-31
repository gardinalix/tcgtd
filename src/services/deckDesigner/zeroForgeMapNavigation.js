export function calculateMapRevealScroll({
  position,
  nodeSize,
  zoom = 1,
  viewportWidth = 0,
  viewportHeight = 0,
  scrollLeft = 0,
  scrollTop = 0,
  padding = 40,
} = {}) {
  if (!position || !nodeSize || viewportWidth <= 0 || viewportHeight <= 0) {
    return { scrollLeft, scrollTop };
  }

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const left = Number(position.x || 0) * safeZoom;
  const top = Number(position.y || 0) * safeZoom;
  const right = left + (Number(nodeSize.width || 0) * safeZoom);
  const bottom = top + (Number(nodeSize.height || 0) * safeZoom);
  const horizontalPadding = Math.min(padding, viewportWidth / 3);
  const verticalPadding = Math.min(padding, viewportHeight / 3);
  let nextScrollLeft = scrollLeft;
  let nextScrollTop = scrollTop;

  if (left < scrollLeft + horizontalPadding) {
    nextScrollLeft = left - horizontalPadding;
  } else if (right > scrollLeft + viewportWidth - horizontalPadding) {
    nextScrollLeft = right - viewportWidth + horizontalPadding;
  }

  if (top < scrollTop + verticalPadding) {
    nextScrollTop = top - verticalPadding;
  } else if (bottom > scrollTop + viewportHeight - verticalPadding) {
    nextScrollTop = bottom - viewportHeight + verticalPadding;
  }

  return {
    scrollLeft: Math.max(0, nextScrollLeft),
    scrollTop: Math.max(0, nextScrollTop),
  };
}

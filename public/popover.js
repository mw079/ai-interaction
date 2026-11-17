// Keep the transient choice surface attached to its source and inside the viewport.
export function positionPopover(anchor, width, height, viewportWidth, viewportHeight) {
  const margin=16,gap=10;
  const w=Math.max(1,Math.min(width,viewportWidth-margin*2));
  const h=Math.min(height,Math.max(1,viewportHeight-margin*2));
  const left=Math.max(margin,Math.min(anchor.left-18,viewportWidth-w-margin));
  const above=viewportHeight-anchor.bottom-gap-margin<h && anchor.top-margin-gap>=h;
  const top=Math.max(margin,Math.min(above?anchor.top-gap-h:anchor.bottom+gap,viewportHeight-h-margin));
  const arrow=Math.max(22,Math.min(anchor.left+Math.min(anchor.width,100)/2-left,w-22));
  return {left,top,width:w,arrow,side:above?'above':'below'};
}

// Keep touch navigation at the page's intended scale.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, event => event.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', event => {
    if (event.touches.length > 1) event.preventDefault();
}, { passive: false });
document.addEventListener('dblclick', event => {
    if (matchMedia('(any-pointer: coarse)').matches) event.preventDefault();
});

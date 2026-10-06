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

// Short tactile feedback for deliberate taps on interactive controls.
let lastHaptic = -Infinity;
document.addEventListener('click', event => {
    if (!event.isTrusted || document.hidden ||
        !matchMedia('(any-pointer: coarse)').matches ||
        typeof navigator.vibrate !== 'function') return;
    const control = event.target?.closest?.('button,a[href],[role="button"],input[type="checkbox"],input[type="radio"]');
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
    const now = performance.now();
    if (now - lastHaptic < 80) return;
    lastHaptic = now;
    try { navigator.vibrate(12); } catch {}
}, { capture: true });

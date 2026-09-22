// SPA mode: nothing is prerendered or rendered on a server, so the audio graph created in
// +layout.svelte is the only instance that ever exists — it survives every client-side navigation.
export const ssr = false;
export const prerender = false;

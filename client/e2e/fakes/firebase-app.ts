// E2E fake of firebase/app — no network.
export function initializeApp(config: any) { return { name: '[e2e]', options: config } }
export default { initializeApp }

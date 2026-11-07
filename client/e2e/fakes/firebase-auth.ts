// E2E fake of firebase/auth: a signed-in test user, no network.
const TEST_USER: any = { uid: 'e2e-user', email: 'tester@example.lk', displayName: 'Test User', photoURL: '', phoneNumber: '' }
const listeners = new Set<(u: any) => void>()
const auth: any = { currentUser: (globalThis as any).localStorage?.getItem('e2e-signed-out') ? null : TEST_USER }
export type User = any
export const indexedDBLocalPersistence = {}, browserLocalPersistence = {}, browserPopupRedirectResolver = {}
export function initializeAuth() { return auth }
export function getAuth() { return auth }
export function onAuthStateChanged(_a: any, cb: (u: any) => void) { listeners.add(cb); setTimeout(() => cb(auth.currentUser), 0); return () => listeners.delete(cb) }
const set = (u: any) => { auth.currentUser = u; listeners.forEach(l => l(u)) }
export async function signInWithEmailAndPassword() { set(TEST_USER); return { user: TEST_USER } }
export async function createUserWithEmailAndPassword() { set(TEST_USER); return { user: TEST_USER } }
export async function signInWithPopup() { set(TEST_USER); return { user: TEST_USER } }
export async function signOut() { set(null) }
export async function updateProfile() {}
export async function updatePassword() {}
export async function reauthenticateWithCredential() {}
export class GoogleAuthProvider {}
export const EmailAuthProvider = { credential: () => ({}) }

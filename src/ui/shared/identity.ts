/**
 * Client-side identity cache (REQUIREMENTS §4): remembers which roster member
 * this device belongs to, so a person taps their name only once per device.
 * Trust-based, no login — if localStorage is cleared they pick again.
 */
const STORAGE_KEY = 'khatma.memberId';

/** The remembered member id for this device, or null if not chosen yet. */
export function getRememberedMemberId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/** Remember the chosen member id on this device. */
export function rememberMemberId(memberId: string): void {
  localStorage.setItem(STORAGE_KEY, memberId);
}

/** Forget the remembered member (e.g. "not me" / switch person). */
export function forgetMember(): void {
  localStorage.removeItem(STORAGE_KEY);
}

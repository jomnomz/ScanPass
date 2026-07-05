// Fixed 8-color palette. Order matters only in that it's stable across reloads.
const PROFILE_PALETTE = [
  { bg: '#3B82F6', text: '#FFFFFF' }, // blue
  { bg: '#10B981', text: '#FFFFFF' }, // green
  { bg: '#F59E0B', text: '#1A2332' }, // amber (dark text — amber is too light for white text)
  { bg: '#8B5CF6', text: '#FFFFFF' }, // purple
  { bg: '#EF4444', text: '#FFFFFF' }, // red
  { bg: '#92400E', text: '#FFFFFF' }, // brown
  { bg: '#06B6D4', text: '#FFFFFF' }, // cyan
  { bg: '#EC4899', text: '#FFFFFF' }, // pink
];

// Simple deterministic string hash (djb2-ish). Same input -> same output, always.
function hashStringToIndex(str, modulo) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // force 32-bit int, prevents runaway growth
  }
  return Math.abs(hash) % modulo;
}

/**
 * Returns a stable { bg, text } pair for a given seed.
 * Prefer a stable unique id; only fall back to name if id is missing.
 */
export function getProfileColor(seed) {
  const key = String(seed ?? 'unknown');
  const index = hashStringToIndex(key, PROFILE_PALETTE.length);
  return PROFILE_PALETTE[index];
}

export function getProfileInitial(firstName) {
  if (!firstName || !firstName.trim()) return '?';
  return firstName.trim().charAt(0).toUpperCase();
}
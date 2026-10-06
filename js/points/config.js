/** Public, read-only bridge settings. No Google credentials are needed. */
export const pointsConfig = Object.freeze({
  apiEnabled: true,
  apiUrl: 'https://script.google.com/macros/s/AKfycbzvjjb0lZIkS8_NXQ6OYtnicCnqTs_Sou8ZhdywP3sfujUsvPC0zMjxvydGHGdOXfhfVg/exec',
  expectedSchemaVersion: 1,
  cacheDurationMs: 60_000,
  requestTimeoutMs: 15_000,
  cacheVersion: 1,
  storageKey: 'dcap.points.public.v1',
});

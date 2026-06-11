/**
 * Slim first-party analytics client for Bolado.
 *
 * Sends events to the shared Cloudflare Worker collector. No vendor SDKs and
 * no traffic-attribution machinery — Bolado only fires daily_* events.
 * Analytics must never interrupt the game.
 */

export const FIRST_PARTY_ANALYTICS_ENDPOINT = "https://brasileirao-analytics.thiago-oliveira77.workers.dev/collect";

export const APP_VERSION = "bolado-0.1.0";

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;
type CleanAnalyticsProperties = Record<string, Exclude<AnalyticsValue, undefined>>;

const SESSION_STORAGE_KEY = "brasileirao_analytics_session";

export function trackFirstPartyEvent(name: string, properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined" || !FIRST_PARTY_ANALYTICS_ENDPOINT) return;
  const cleanProperties = cleanAnalyticsProperties({ ...properties, appVersion: APP_VERSION });

  const payload = JSON.stringify({
    name,
    properties: cleanProperties,
    path: window.location.pathname,
    referrer: document.referrer,
    sessionId: getAnalyticsSessionId(),
  });

  try {
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(FIRST_PARTY_ANALYTICS_ENDPOINT, new Blob([payload], { type: "application/json" }));
      if (sent) return;
    }

    void fetch(FIRST_PARTY_ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never interrupt the game.
  }
}

export function cleanAnalyticsProperties(properties: object): CleanAnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, Exclude<AnalyticsValue, undefined>] => isAnalyticsValue(entry[1])),
  );
}

function isAnalyticsValue(value: unknown): value is Exclude<AnalyticsValue, undefined> {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

let fallbackSessionId: string | null = null;

function getAnalyticsSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    fallbackSessionId ??= typeof crypto?.randomUUID === "function" ? `pl-${crypto.randomUUID()}` : "anonymous";
    return fallbackSessionId;
  }
}

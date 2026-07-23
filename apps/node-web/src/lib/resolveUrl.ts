/**
 * Resolve a gateway-relative playback URL (`VideoDetail.playback.mp4Url`
 * etc. are gateway-root-relative, e.g. `/media/blob/<hex>` —
 * `apps/gateway/server/src/api/view-helpers.ts`) against the gateway
 * origin this app fetched it from. Only used for `<video>`/`<audio>
 * src>` attributes read directly by the webview's media stack, never for
 * a JS-side `fetch()` — see `src/lib/tauri.ts`'s module doc for why this
 * app has no fetches to CORS-guard in the first place.
 */
export function resolveGatewayUrl(gatewayUrl: string, maybeRelative: string | null | undefined): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, gatewayUrl).toString();
  } catch {
    return null;
  }
}

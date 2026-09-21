const imageProbeCache = new Map();

function allowedMarketplaceImageHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "mlstatic.com" || host.endsWith(".mlstatic.com");
}

export function normalizeMarketplaceImageUrl(value) {
  const raw = String(value || "").trim().replace(/^http:/i, "https:");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !allowedMarketplaceImageHost(url.hostname)) return "";
    if (/\/resources\/frontend\/statics\/processing-image\//i.test(url.pathname)) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function marketplaceImageCandidates(pictures = [], fallbacks = []) {
  const candidates = [];
  for (const picture of Array.isArray(pictures) ? pictures : []) {
    if (typeof picture === "string") candidates.push(picture);
    else if (picture && typeof picture === "object") {
      candidates.push(picture.secure_url, picture.url, picture.source);
    }
  }
  candidates.push(...(Array.isArray(fallbacks) ? fallbacks : [fallbacks]));
  return [...new Set(candidates.map(normalizeMarketplaceImageUrl).filter(Boolean))];
}

export async function isLoadableMarketplaceImage(
  value,
  { fetchImpl = fetch, timeoutMs = 12000, useCache = true } = {},
) {
  const url = normalizeMarketplaceImageUrl(value);
  if (!url) return false;
  if (useCache && imageProbeCache.has(url)) return imageProbeCache.get(url);
  const probe = (async () => {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          range: "bytes=0-2047",
          "user-agent": "RankingDaCompra/1.0",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      const finalUrl = normalizeMarketplaceImageUrl(response.url || url);
      const valid = (response.ok || response.status === 206) && contentType.startsWith("image/") && Boolean(finalUrl);
      await response.body?.cancel?.().catch?.(() => {});
      return valid;
    } catch {
      return false;
    }
  })();
  if (useCache) imageProbeCache.set(url, probe);
  return probe;
}

export async function selectLoadableMarketplaceImage(candidates, options = {}) {
  for (const candidate of marketplaceImageCandidates([], candidates)) {
    if (await isLoadableMarketplaceImage(candidate, options)) return candidate;
  }
  return "";
}

export function clearMarketplaceImageProbeCache() {
  imageProbeCache.clear();
}

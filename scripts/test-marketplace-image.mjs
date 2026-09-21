import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMarketplaceImageProbeCache,
  marketplaceImageCandidates,
  normalizeMarketplaceImageUrl,
  selectLoadableMarketplaceImage,
} from "./marketplace-image.mjs";

test("aceita somente imagens HTTPS do CDN oficial e descarta a imagem de processamento", () => {
  assert.equal(normalizeMarketplaceImageUrl("http://http2.mlstatic.com/D_NQ_NP_123-O.webp"), "https://http2.mlstatic.com/D_NQ_NP_123-O.webp");
  assert.equal(normalizeMarketplaceImageUrl("https://example.com/foto.jpg"), "");
  assert.equal(normalizeMarketplaceImageUrl("https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg"), "");
});

test("tenta as demais fotos quando a primeira não carrega", async () => {
  clearMarketplaceImageProbeCache();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const ok = url.includes("segunda");
    return {
      ok,
      status: ok ? 206 : 404,
      url,
      headers: { get: (name) => name === "content-type" ? (ok ? "image/webp" : "text/html") : "" },
      body: { cancel: async () => {} },
    };
  };
  const selected = await selectLoadableMarketplaceImage([
    "https://http2.mlstatic.com/primeira.webp",
    "https://http2.mlstatic.com/segunda.webp",
  ], { fetchImpl, useCache: false });
  assert.equal(selected, "https://http2.mlstatic.com/segunda.webp");
  assert.deepEqual(calls, [
    "https://http2.mlstatic.com/primeira.webp",
    "https://http2.mlstatic.com/segunda.webp",
  ]);
});

test("reúne todas as variantes fornecidas pela API sem duplicação", () => {
  assert.deepEqual(marketplaceImageCandidates([
    { secure_url: "https://http2.mlstatic.com/a.webp", url: "http://http2.mlstatic.com/a.webp" },
    { source: "https://http2.mlstatic.com/b.jpg" },
  ], "https://http2.mlstatic.com/b.jpg"), [
    "https://http2.mlstatic.com/a.webp",
    "https://http2.mlstatic.com/b.jpg",
  ]);
});

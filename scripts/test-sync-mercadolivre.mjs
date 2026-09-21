import test from "node:test";
import assert from "node:assert/strict";
import {
  bulkItemAttributes,
  bulkItemFromEntry,
  catalogRecordFromPayload,
  extractCatalogIdFromUrl,
  extractItemIdFromUrl,
  isMercadoLivreProduct,
  repairLegacyHiddenRecords,
  shouldRetryBulkOutcome,
  shouldTrustStoredItemId,
} from "./sync-mercadolivre.mjs";

test("solicita somente campos body no filtro oficial do endpoint bulk", () => {
  const attributes = bulkItemAttributes().split(",");
  assert.equal(attributes.length, 7);
  assert.equal(attributes.every((attribute) => attribute.startsWith("body.")), true);
  assert.equal(attributes.includes("id"), false);
  assert.equal(attributes.includes("status_code"), false);
});

test("interpreta a resposta oficial do novo endpoint bulk", () => {
  assert.deepEqual(bulkItemFromEntry({
    id: "MLB1234567890",
    status_code: 200,
    body: { id: "MLB1234567890", price: 199.9, status: "active" },
  }), {
    item: { id: "MLB1234567890", price: 199.9, status: "active" },
    error: null,
  });
  assert.deepEqual(bulkItemFromEntry({
    body: { id: "MLB1234567890", price: 199.9, status: "active" },
  }), {
    item: { id: "MLB1234567890", price: 199.9, status: "active" },
    error: null,
  }, "aceita o body válido quando a seleção de campos omite status_code");
  assert.deepEqual(bulkItemFromEntry({ status_code: 404 }), {
    item: null,
    error: null,
    notFound: true,
  });
  const denied = bulkItemFromEntry({ status_code: 403, body: { message: "forbidden" } });
  assert.equal(denied.item, null);
  assert.equal(denied.error.httpStatus, 403);
});

test("recupera somente falhas temporarias do endpoint bulk", () => {
  const badGateway = bulkItemFromEntry({
    id: "MLB1234567890",
    status_code: 502,
    body: { message: "bad_gateway" },
  });
  const limited = bulkItemFromEntry({ status_code: 429 });
  const forbidden = bulkItemFromEntry({ status_code: 403 });
  assert.equal(shouldRetryBulkOutcome(badGateway), true);
  assert.equal(shouldRetryBulkOutcome(limited), true);
  assert.equal(shouldRetryBulkOutcome(forbidden), false);
  assert.equal(shouldRetryBulkOutcome({ item: { id: "MLB1234567890" }, error: null }), false);
});

test("mantem produtos antigos no lote MLB e ignora produtos Shopee", () => {
  assert.equal(isMercadoLivreProduct({ link: "https://www.mercadolivre.com.br/produto" }), true);
  assert.equal(isMercadoLivreProduct({ marketplace: "mercado_livre" }), true);
  assert.equal(isMercadoLivreProduct({ marketplace: "shopee", link: "https://shopee.com.br/produto" }), false);
  assert.equal(isMercadoLivreProduct({ linkAfiliado: "https://s.shopee.com.br/exemplo" }), false);
});

test("usa o catálogo oficial quando o anúncio individual é recusado", () => {
  const url = "https://www.mercadolivre.com.br/liquidificador/p/MLB15699907?wid=MLB3306024289";
  assert.equal(extractCatalogIdFromUrl(url), "MLB15699907");
  assert.deepEqual(catalogRecordFromPayload("MLB15699907", {
    id: "MLB15699907",
    buy_box_winner: {
      item_id: "MLB3306024289",
      price: 179.9,
      original_price: 219.9,
      currency_id: "BRL",
    },
  }), {
    itemId: "MLB3306024289",
    catalogId: "MLB15699907",
    status: "active",
    available: true,
    price: 179.9,
    regularPrice: 219.9,
    currencyId: "BRL",
    source: "catalog_api",
  });
});

test("prioriza o wid real em uma pagina de catalogo", () => {
  const url = "https://www.mercadolivre.com.br/notebook/p/MLB35715045"
    + "?pdp_filters=deal%3AMLB779362-1&wid=MLB4604524838";
  assert.equal(extractItemIdFromUrl(url), "MLB4604524838");
});

test("nao trata codigo de catalogo como anuncio indisponivel", () => {
  const product = {
    link: "https://www.mercadolivre.com.br/notebook/p/MLB35715045",
    linkAfiliado: "https://meli.la/exemplo",
  };
  assert.equal(shouldTrustStoredItemId("MLB35715045", product), false);
  assert.equal(shouldTrustStoredItemId("MLB779362", product), false);
  assert.equal(shouldTrustStoredItemId("MLB4604524838", product), true);
});

test("mantem codigo explicito quando nao ha endereco para conferir", () => {
  assert.equal(shouldTrustStoredItemId("MLB1234567", {}), true);
});

test("reativa somente falsos indisponiveis antigos com codigo de catalogo", () => {
  const previous = {
    version: 1,
    products: {
      catalogo: {
        itemId: "MLB779362",
        status: "not_found",
        visible: false,
        available: false,
        managed: true,
        unavailableChecks: 2,
      },
      anuncioReal: {
        itemId: "MLB4671364943",
        status: "inactive",
        visible: false,
        available: false,
        managed: true,
        unavailableChecks: 2,
      },
    },
  };
  const { repaired, payload } = repairLegacyHiddenRecords(previous, "2026-09-09T15:00:00.000Z");
  assert.equal(repaired, 1);
  assert.equal(payload.products.catalogo.visible, true);
  assert.equal(payload.products.catalogo.status, "missing_item_id");
  assert.equal(payload.products.catalogo.itemId, "");
  assert.equal(payload.products.catalogo.unavailableChecks, 0);
  assert.deepEqual(payload.products.anuncioReal, previous.products.anuncioReal);
});


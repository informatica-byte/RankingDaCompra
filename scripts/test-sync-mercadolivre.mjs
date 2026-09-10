import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogRecordFromPayload,
  extractCatalogIdFromUrl,
  extractItemIdFromUrl,
  repairLegacyHiddenRecords,
  shouldTrustStoredItemId,
} from "./sync-mercadolivre.mjs";

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


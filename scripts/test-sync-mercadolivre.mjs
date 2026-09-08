import test from "node:test";
import assert from "node:assert/strict";
import {
  extractItemIdFromUrl,
  shouldTrustStoredItemId,
} from "./sync-mercadolivre.mjs";

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


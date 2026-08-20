import { readFile } from "node:fs/promises";

const HOST = "rankingdacompra.com.br";
const BASE_URL = `https://${HOST}`;
const KEY = "a48ec2b29d0a3892eaa1cc5b1f6ce8aa1819677da9737563";
const KEY_LOCATION = `${BASE_URL}/a48ec2b29d0a3892eaa1cc5b1f6ce8aa1819677da9737563.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";

function lerUrlsDoSitemap(xml) {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .filter((endereco) => {
      try {
        const url = new URL(endereco);
        return url.protocol === "https:" && url.hostname === HOST;
      } catch {
        return false;
      }
    });

  return [...new Set(urls)].slice(0, 10000);
}

async function enviarIndexNow() {
  const xml = await readFile("sitemap.xml", "utf8");
  const urlList = lerUrlsDoSitemap(xml);

  if (!urlList.length) {
    throw new Error("O sitemap não contém URLs válidas do Ranking da Compra.");
  }

  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList
    })
  });

  const detalhes = await resposta.text();

  if (![200, 202].includes(resposta.status)) {
    throw new Error(
      `IndexNow recusou o envio (HTTP ${resposta.status})${detalhes ? `: ${detalhes}` : ""}`
    );
  }

  console.log(
    `IndexNow recebeu ${urlList.length} URL(s) do Ranking da Compra (HTTP ${resposta.status}).`
  );
}

enviarIndexNow().catch((erro) => {
  console.error("Falha ao avisar o IndexNow:", erro.message);
  process.exitCode = 1;
});

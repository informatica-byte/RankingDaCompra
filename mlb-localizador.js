import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const SITE = "https://rankingdacompra.com.br/";
const RESULTADOS = `${SITE}mlb-resolucoes.json`;
const app = getApps().find((item) => item.name === "[DEFAULT]") || getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const card = document.createElement("section");
card.className = "card";
card.id = "localizador-mlb";
card.innerHTML = `
  <div class="etapa">Localizador de produto</div>
  <h2>Descobrir código MLB</h2>
  <p>Cole o link de afiliado ou o ID de recomendação. O robô abre a indicação fora do aplicativo e identifica o anúncio destacado.</p>
  <label for="mlb-entrada">Link ou ID do afiliado</label>
  <input id="mlb-entrada" class="campo" inputmode="url" placeholder="https://meli.la/... ou KSDZN8-VC5M">
  <button id="mlb-localizar" class="btn azul" type="button">🔎 Localizar produto e MLB</button>
  <div id="mlb-status" class="status"></div>
  <div id="mlb-resultado" hidden style="margin-top:13px;padding:14px;border:1px solid #9dd7bd;border-radius:12px;background:#effaf4">
    <b id="mlb-titulo">Produto encontrado</b>
    <label for="mlb-codigo">Código técnico do anúncio</label>
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
      <input id="mlb-codigo" class="campo" readonly>
      <button id="mlb-copiar" class="btn verde" type="button" style="width:auto;margin-top:0;min-height:49px">Copiar MLB</button>
    </div>
    <a id="mlb-abrir" class="btn claro" style="display:flex;align-items:center;justify-content:center;text-decoration:none" target="_blank" rel="noopener">Abrir produto no navegador</a>
  </div>`;

const appSection = document.getElementById("app");
const firstCard = appSection?.querySelector(".card");
if (appSection && firstCard) firstCard.insertAdjacentElement("afterend", card);

const $ = (id) => document.getElementById(id);
const status = (text, type = "") => {
  const box = $("mlb-status");
  box.textContent = text;
  box.className = `status on ${type}`;
};

const normalize = (value) => {
  const text = String(value || "").trim();
  if (/^[A-Z0-9]{4,}(?:-[A-Z0-9]{3,})+$/i.test(text)) {
    return `https://lista.mercadolivre.com.br/${encodeURIComponent(text)}`;
  }
  return text;
};

function display(result) {
  $("mlb-codigo").value = result.mlb || "";
  $("mlb-titulo").textContent = result.titulo || "Produto encontrado";
  $("mlb-abrir").href = result.urlProduto || result.linkOriginal || "#";
  $("mlb-resultado").hidden = false;
  status("Produto identificado. Copie o MLB ou abra o anúncio para conferir.", "ok");
}

async function waitForResult(requestId) {
  const started = Date.now();
  while (Date.now() - started < 12 * 60 * 1000) {
    const response = await fetch(`${RESULTADOS}?v=${Date.now()}`, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      const result = payload?.resultados?.[requestId];
      if (result?.status === "ok" && result.mlb) {
        localStorage.removeItem("rankingMlbPendente");
        display(result);
        return;
      }
      if (result?.status === "erro") {
        localStorage.removeItem("rankingMlbPendente");
        status(result.motivo || "O produto não pôde ser identificado. Tente outro link.", "erro");
        return;
      }
    }
    const elapsed = Math.max(1, Math.floor((Date.now() - started) / 60000));
    status(`Pedido recebido. O robô está abrindo o Mercado Livre (${elapsed} min). Você pode deixar esta página aberta.`);
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
  status("O robô ainda não terminou. Volte a esta página em alguns minutos; a consulta continuará salva.");
}

$("mlb-localizar").addEventListener("click", async () => {
  const raw = $("mlb-entrada").value.trim() || document.getElementById("link")?.value.trim();
  const link = normalize(raw);
  if (!link || !/(mercadolivre|mercadolibre|meli\.la)/i.test(link)) {
    status("Cole um link do Mercado Livre ou um ID como KSDZN8-VC5M.", "erro");
    return;
  }
  if (!auth.currentUser) {
    status("Entre no painel antes de usar o localizador.", "erro");
    return;
  }
  const button = $("mlb-localizar");
  button.disabled = true;
  $("mlb-resultado").hidden = true;
  try {
    status("Enviando para o robô gratuito do GitHub...");
    const docRef = await addDoc(collection(db, "mlbSolicitacoes"), {
      link,
      entradaOriginal: raw,
      status: "pendente",
      solicitadoPor: auth.currentUser.uid,
      criadoEm: serverTimestamp()
    });
    localStorage.setItem("rankingMlbPendente", docRef.id);
    await waitForResult(docRef.id);
  } catch (error) {
    status(`Não foi possível solicitar agora: ${error?.message || error}`, "erro");
  } finally {
    button.disabled = false;
  }
});

$("mlb-copiar").addEventListener("click", async () => {
  const code = $("mlb-codigo").value;
  if (!code) return;
  await navigator.clipboard.writeText(code);
  $("mlb-copiar").textContent = "✅ Copiado";
  setTimeout(() => { $("mlb-copiar").textContent = "Copiar MLB"; }, 1800);
});

onAuthStateChanged(auth, () => {
  const pending = localStorage.getItem("rankingMlbPendente");
  if (auth.currentUser && pending) waitForResult(pending).catch(() => {});
});

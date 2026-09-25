import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { doc, getFirestore, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAI, getGenerativeModel, GoogleAIBackend, ResponseModality } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-ai.js";

const SITE = "https://rankingdacompra.com.br";
const YOUTUBE_CLIENT_KEY = "rdc-youtube-oauth-client-id";
const firebaseConfig = {
  apiKey: "AIzaSyChRBmFfokCPPec7oTdC1u9obQg6M83Epk",
  authDomain: "rankingdacompra.firebaseapp.com",
  projectId: "rankingdacompra",
  storageBucket: "rankingdacompra.firebasestorage.app",
  messagingSenderId: "300637600463",
  appId: "1:300637600463:web:671c78dc47d5f8b39f15ba"
};

const app = initializeApp(firebaseConfig, "ranki-video-studio");
initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("6LeNOlUtAAAAAOHg_j1l5d7AkzLGnxNF6LszSoOp"),
  isTokenAutoRefreshEnabled: true
});
const auth = getAuth(app);
const db = getFirestore(app);
const ai = getAI(app, { backend: new GoogleAIBackend() });

const $ = (id) => document.getElementById(id);
const state = {
  catalog: [],
  filtered: [],
  product: null,
  productImage: null,
  uploadedImages: [],
  uploadedImageUrls: [],
  rankiImage: null,
  audioBlob: null,
  audioUrl: "",
  audioDuration: 0,
  videoBlob: null,
  videoUrl: "",
  videoMime: "",
  drawing: 0,
  sceneVideo: null,
  sceneVideoUrl: "",
  previewDrawing: 0
};

function status(id, text, type = "") {
  const element = $(id);
  element.textContent = text;
  element.className = `status on${type ? ` ${type}` : ""}`;
}

function clearStatus(id) {
  $(id).className = "status";
  $(id).textContent = "";
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compact(value, limit = 150) {
  const text = clean(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1).replace(/\s+\S*$/, "").trim();
  return `${cut}…`;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number)
    : "preço a confirmar";
}

function normalize(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function sameOriginAsset(url) {
  try {
    const parsed = new URL(url, location.href);
    return parsed.origin === SITE ? `${parsed.pathname}${parsed.search}` : parsed.href;
  } catch {
    return url;
  }
}

function safeYouTubeClientId(value) {
  const clientId = clean(value);
  return /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId) ? clientId : "";
}

function listFromSchema(notes) {
  const items = Array.isArray(notes?.itemListElement) ? notes.itemListElement : [];
  return items.flatMap((item) => clean(item?.name).split(/\s*[,;]\s*/)).filter((item) => item.length >= 12);
}

function findSchema(documentHtml) {
  for (const script of documentHtml.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const payload = JSON.parse(script.textContent);
      const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const product = nodes.find((node) => node?.["@type"] === "Product");
      if (product) return product;
    } catch {
      // Um bloco inválido não deve impedir a leitura do próximo.
    }
  }
  return null;
}

async function loadCatalog() {
  status("catalog-status", "Carregando somente o índice público, sem leitura do Firebase...");
  const response = await fetch(`/search-index.json?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Catálogo indisponível (${response.status}).`);
  const payload = await response.json();
  state.catalog = (Array.isArray(payload.products) ? payload.products : [])
    .filter((item) => item?.id && item?.title && item?.url && item?.image)
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "pt-BR"));
  state.filtered = state.catalog;
  renderProducts();
  status("catalog-status", `${state.catalog.length} produtos publicados disponíveis. Nenhuma leitura do Firebase foi feita.`, "ok");
}

function renderProducts() {
  const select = $("product");
  const previous = select.value;
  select.innerHTML = '<option value="">Escolha um produto</option>' + state.filtered
    .map((item) => `<option value="${item.id}">${clean(item.title).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character])}</option>`)
    .join("");
  if (state.filtered.some((item) => item.id === previous)) select.value = previous;
}

async function loadProduct(id) {
  const indexed = state.catalog.find((item) => item.id === id);
  if (!indexed) return;
  status("catalog-status", "Carregando a análise pública deste produto...");
  const pageUrl = new URL(indexed.url, SITE);
  const response = await fetch(`${pageUrl.pathname}?studio=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Página do produto indisponível (${response.status}).`);
  const html = new DOMParser().parseFromString(await response.text(), "text/html");
  const schema = findSchema(html) || {};
  const offer = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers || {};
  const review = Array.isArray(schema.review) ? schema.review[0] : schema.review || {};
  const images = Array.isArray(schema.image) ? schema.image : [schema.image];
  const pros = listFromSchema(review.positiveNotes);
  const cons = listFromSchema(review.negativeNotes);
  if ($("product").value !== id) return;
  if (state.product?.id !== indexed.id) {
    clearSceneVideo();
    clearProductImages();
    invalidateMedia();
  }
  state.product = {
    id: indexed.id,
    title: clean(schema.name || indexed.title),
    category: clean(schema.category || indexed.category),
    summary: clean(review.reviewBody || schema.description || indexed.summary),
    image: sameOriginAsset(images.find(Boolean) || indexed.image),
    price: Number(offer.price || indexed.price) || 0,
    url: indexed.url,
    pros,
    cons
  };
  $("product-image-small").src = state.product.image;
  $("product-image-small").alt = state.product.title;
  $("product-title-small").textContent = state.product.title;
  $("product-meta-small").textContent = `${state.product.category} · ${money(state.product.price)}`;
  $("product-summary").classList.remove("hidden");
  $("prepare-script").disabled = false;
  await loadVisualAssets();
  drawFrame(0.08);
  if (state.productImage) status("catalog-status", "Produto pronto. Agora prepare e revise o roteiro.", "ok");
}

function primaryFact(items, fallback) {
  return compact(items.find((item) => item.length >= 18) || fallback, 58).replace(/[.!?]+$/, "");
}

function scriptForProduct() {
  const product = state.product;
  const title = compact(product.title, 55);
  const summaryFact = primaryFact(product.summary.split(/[.;]\s+/), `é uma opção da categoria ${product.category}`);
  const positive = primaryFact(product.pros, summaryFact);
  const attention = primaryFact(product.cons, "confira medidas, garantia, frete e compatibilidade antes da compra");
  const type = $("video-type").value;
  if (type === "vale") return `Eu sou o Ranki. ${title} vale a pena? Destaque: ${positive}. Atenção: ${attention}. Veja a análise no Ranking da Compra e confirme o preço no vendedor.`;
  if (type === "pros") return `Eu sou o Ranki. Prós e contras de ${title}. Ponto positivo: ${positive}. Atenção: ${attention}. Confira a análise completa antes de decidir.`;
  return `Eu sou o Ranki. Conheça ${title}. Destaque: ${positive}. Atenção: ${attention}. Veja a análise no Ranking da Compra e confirme o preço no vendedor.`;
}

function descriptionForProduct() {
  const product = state.product;
  const categoryTag = normalize(product.category).replace(/[^a-z0-9]+/g, "");
  return `${compact(product.title, 100)}: veja preço, pontos positivos e limitações na análise completa.\n\n${product.url}\n\nPreço e estoque podem mudar. Alguns links são de afiliados e podem gerar comissão sem custo adicional para você.\n\n#RankingDaCompra #Ranki #${categoryTag || "Ofertas"} #Shorts`;
}

function prepareScript() {
  if (!state.product) return;
  $("script").value = compact(scriptForProduct(), 700);
  $("video-title").value = compact(`${state.product.title}: vale a pena? | Ranki`, 100);
  $("video-description").value = descriptionForProduct();
  updateScriptCount();
  invalidateMedia();
  $("generate-voice").disabled = false;
  drawFrame(0.08);
  status("voice-status", "Roteiro preparado. Revise cada frase antes de gerar a voz.", "ok");
}

function updateScriptCount() {
  const script = clean($("script").value);
  $("script-count").textContent = $("script").value.length;
  $("script-duration").textContent = script ? Math.round(script.split(" ").length / 2.5) : 0;
}

function invalidateMedia() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioBlob = null;
  state.audioUrl = "";
  state.audioDuration = 0;
  invalidateVideo();
  $("audio-preview").pause();
  $("audio-preview").removeAttribute("src");
  $("audio-preview").classList.add("hidden");
  $("create-video").disabled = true;
}

function invalidateVideo() {
  stopVisualPreview();
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoBlob = null;
  state.videoUrl = "";
  state.videoMime = "";
  $("download-video").classList.remove("on");
  $("download-video").removeAttribute("href");
  $("upload-youtube").disabled = true;
  clearStatus("video-status");
}

function clearSceneVideo() {
  stopVisualPreview();
  if (state.sceneVideo) {
    state.sceneVideo.pause();
    state.sceneVideo.onloadeddata = null;
    state.sceneVideo.onerror = null;
    state.sceneVideo.removeAttribute("src");
    state.sceneVideo.load();
  }
  if (state.sceneVideoUrl) URL.revokeObjectURL(state.sceneVideoUrl);
  state.sceneVideo = null;
  state.sceneVideoUrl = "";
  $("scene-video").value = "";
  $("clear-scene-video").hidden = true;
  drawFrame(0.08);
}

function clearProductImages() {
  state.uploadedImageUrls.forEach((url) => URL.revokeObjectURL(url));
  state.uploadedImageUrls = [];
  state.uploadedImages = [];
  $("product-images").value = "";
  $("clear-product-images").hidden = true;
  invalidateVideo();
  drawFrame(0.08);
}

async function loadProductImages(files) {
  clearProductImages();
  if (!files.length) return;
  if (!state.product) return status("video-status", "Escolha primeiro o produto que aparecerá nas fotos.", "error");
  const productId = state.product.id;
  if (files.length > 4 || files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 6 * 1024 * 1024)) {
    return status("video-status", "Escolha até 4 fotos PNG, JPG ou WebP de até 6 MB cada.", "error");
  }
  const urls = files.map((file) => URL.createObjectURL(file));
  try {
    const images = await Promise.all(urls.map(loadImage));
    if (state.product?.id !== productId) {
      urls.forEach((url) => URL.revokeObjectURL(url));
      return;
    }
    state.uploadedImages = images;
    state.uploadedImageUrls = urls;
    $("clear-product-images").hidden = false;
    drawFrame(0.08);
    status("video-status", `${images.length} foto(s) adicionada(s) à montagem. Confira a prévia antes de publicar.`, "ok");
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    $("product-images").value = "";
    status("video-status", `Não foi possível abrir as fotos: ${clean(error.message)}`, "error");
  }
}

function sceneProductImage(progress) {
  if (!state.uploadedImages.length) return state.productImage;
  const index = Math.min(state.uploadedImages.length - 1, Math.floor(Math.max(0, progress) * state.uploadedImages.length));
  return state.uploadedImages[index];
}

async function loadSceneVideo(file) {
  clearSceneVideo();
  invalidateVideo();
  if (!file) return;
  if (!state.product) return status("video-status", "Escolha primeiro o produto desta cena.", "error");
  const productId = state.product.id;
  if (!(["video/mp4", "video/webm"].includes(file.type) || /\.(mp4|webm)$/i.test(file.name)) || file.size > 150 * 1024 * 1024) {
    return status("video-status", "Escolha um MP4 ou WebM de até 150 MB.", "error");
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("A cena demorou demais para abrir.")), 12000);
      video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
      video.onerror = () => { clearTimeout(timeout); reject(new Error("O navegador não conseguiu abrir esta cena.")); };
      video.src = url;
    });
    if (!video.videoWidth || !video.videoHeight) throw new Error("A cena não contém imagem válida.");
    if (state.product?.id !== productId) throw new Error("O produto mudou durante a carga. Selecione a cena novamente.");
    state.sceneVideo = video;
    state.sceneVideoUrl = url;
    $("clear-scene-video").hidden = false;
    $("visual-style").value = "cinematic";
    drawFrame(0.08);
    status("video-status", "Cena carregada só neste aparelho. Revise se corresponde ao produto antes de publicar.", "ok");
  } catch (error) {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    $("scene-video").value = "";
    status("video-status", clean(error.message), "error");
  }
}

function browserPreview() {
  const text = clean($("script").value);
  if (!text) return status("voice-status", "Prepare o roteiro primeiro.", "error");
  if (!("speechSynthesis" in window)) return status("voice-status", "Este navegador não possui prévia de voz.", "error");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1.03;
  utterance.pitch = 1.08;
  const voice = speechSynthesis.getVoices().find((item) => /^pt[-_]BR/i.test(item.lang));
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
  status("voice-status", "Reproduzindo uma prévia simples pela voz do aparelho. Ela não será usada no vídeo final.", "ok");
}

function pcmToWav(base64, sampleRate = 24000) {
  const pcm = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const write = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

async function generateVoice() {
  const transcript = clean($("script").value);
  if (!state.product || transcript.length < 80) return status("voice-status", "Revise um roteiro com pelo menos 80 caracteres.", "error");
  $("generate-voice").disabled = true;
  status("voice-status", "O Ranki está gravando a narração natural...");
  try {
    const model = getGenerativeModel(ai, {
      model: "gemini-3.1-flash-tts-preview",
      generationConfig: {
        responseModalities: [ResponseModality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: $("voice").value } },
          languageCode: "pt-BR"
        }
      }
    });
    const prompt = `Audio Profile: Ranki é uma raposa apresentadora brasileira, simpática, confiável e objetiva.\nDirector's Notes: Fale em português do Brasil, com ritmo natural de vídeo curto, dicção clara, energia moderada e sem cantar. Leia somente o texto da transcrição.\nTranscript:\n${transcript}`;
    const result = await model.generateContent(prompt);
    const part = result.response.inlineDataParts()?.[0];
    if (!part?.inlineData?.data) throw new Error("A IA não devolveu áudio.");
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioBlob = pcmToWav(part.inlineData.data);
    state.audioUrl = URL.createObjectURL(state.audioBlob);
    $("audio-preview").src = state.audioUrl;
    $("audio-preview").classList.remove("hidden");
    const audioContext = new AudioContext();
    try {
      state.audioDuration = (await audioContext.decodeAudioData(await state.audioBlob.arrayBuffer())).duration;
    } finally {
      await audioContext.close();
    }
    const validDuration = state.audioDuration >= 10 && state.audioDuration <= 20;
    $("create-video").disabled = !validDuration;
    status("voice-status", validDuration
      ? `Voz pronta (${state.audioDuration.toFixed(1)} s). Ouça tudo e então crie o vídeo.`
      : `A voz ficou com ${state.audioDuration.toFixed(1)} s. Ajuste o roteiro para 10–20 s e gere novamente antes de criar o vídeo.`, validDuration ? "ok" : "error");
  } catch (error) {
    console.error(error);
    status("voice-status", `Não foi possível gerar a voz natural agora: ${clean(error?.message || error)}. Use a prévia simples e tente novamente mais tarde.`, "error");
  } finally {
    $("generate-voice").disabled = false;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível carregar a imagem ${url}.`));
    image.src = url;
  });
}

async function loadVisualAssets() {
  if (!state.product) return;
  const theme = $("ranki-theme").value;
  const rankiUrl = theme ? `/assets/ranki/${theme}.png` : "/ranki.png";
  const [productImage, rankiImage] = await Promise.all([
    loadImage(state.product.image).catch(() => null),
    loadImage(rankiUrl)
  ]);
  state.productImage = productImage;
  state.rankiImage = rankiImage;
  if (!productImage && !state.uploadedImages.length) {
    status("catalog-status", "A foto publicada não abriu. Adicione uma foto sua do produto antes de criar o vídeo.", "error");
  }
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawCover(context, image, x, y, width, height, contain = true) {
  if (!image) return;
  const scale = contain ? Math.min(width / image.width, height / image.height) : Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapLines(context, text, maxWidth, maxLines = 4) {
  const words = clean(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else line = test;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const usedWords = lines.join(" ").split(" ").length;
  if (usedWords < words.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]?$/, "")}…`;
  return lines;
}

function subtitles() {
  const parts = clean($("script").value).split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.length ? parts : ["O Ranki apresenta este produto."];
}

function subtitleAt(progress) {
  const parts = subtitles();
  const weights = parts.map((part) => Math.max(12, part.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = progress * total;
  for (let index = 0; index < parts.length; index += 1) {
    if (cursor <= weights[index]) return parts[index];
    cursor -= weights[index];
  }
  return parts[parts.length - 1];
}

function drawFrame(progress = 0) {
  const canvas = $("video-canvas");
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  if ($("visual-style").value === "cinematic") drawCinematicFrame(context, progress);
  else drawClassicFrame(context, progress);
}

function ease(value) {
  const bounded = Math.max(0, Math.min(1, value));
  return bounded * bounded * (3 - 2 * bounded);
}

function drawVideoCover(context, video, width, height) {
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawnWidth = video.videoWidth * scale;
  const drawnHeight = video.videoHeight * scale;
  context.drawImage(video, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  return true;
}

function drawCinematicFrame(context, progress) {
  const width = 1080;
  const height = 1920;
  const product = state.product || { title: "Escolha um produto", category: "Ranking da Compra", price: 0 };
  const scene = Math.min(2, Math.floor(Math.max(0, progress) * 3));
  const visualProductImage = sceneProductImage(progress);
  const sceneProgress = ease((progress * 3) - scene);
  const bob = Math.sin(progress * Math.PI * 12) * 13;
  const hasClip = drawVideoCover(context, state.sceneVideo, width, height);
  if (!hasClip) {
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#071e1e");
    background.addColorStop(0.55, "#116e5b");
    background.addColorStop(1, "#03251e");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    const light = context.createRadialGradient(530 + progress * 160, 670, 60, 530 + progress * 160, 670, 760);
    light.addColorStop(0, "rgba(174,255,220,.42)");
    light.addColorStop(1, "rgba(174,255,220,0)");
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(1,25,22,.5)";
    context.beginPath();
    context.moveTo(0, 1340);
    context.lineTo(width, 1340);
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.fill();
    context.strokeStyle = "rgba(207,255,226,.17)";
    context.lineWidth = 3;
    for (let index = -3; index <= 3; index += 1) {
      context.beginPath();
      context.moveTo(540, 1330);
      context.lineTo(540 + index * 360 + (progress * 35), height);
      context.stroke();
    }
    for (let index = 0; index < 5; index += 1) {
      const y = 1390 + (index * index * 31);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  const shade = context.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "rgba(0,17,14,.68)");
  shade.addColorStop(.28, hasClip ? "rgba(0,17,14,.08)" : "rgba(0,17,14,0)");
  shade.addColorStop(.66, hasClip ? "rgba(0,17,14,.12)" : "rgba(0,17,14,0)");
  shade.addColorStop(1, "rgba(0,17,14,.92)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);

  context.textAlign = "left";
  context.fillStyle = "#acffce";
  context.font = "900 38px system-ui";
  context.fillText("RANKI APRESENTA", 72, 107);
  context.fillStyle = "#ffffff";
  context.font = "950 72px system-ui";
  const headline = scene === 0 ? "OLHA ESTE PRODUTO" : scene === 1 ? "CONHEÇA OS DETALHES" : "DECIDA COM CLAREZA";
  context.fillText(headline, 70, 210);
  context.fillStyle = "#dcfbe8";
  context.font = "700 32px system-ui";
  context.fillText(compact(product.category, 42).toUpperCase(), 72, 268);

  if (!hasClip && state.rankiImage) {
    const rankiSize = scene === 1 ? 560 : 780;
    const rankiX = scene === 1 ? 470 + sceneProgress * 30 : 180 + sceneProgress * 70;
    const rankiY = scene === 1 ? 430 : 360;
    context.save();
    context.translate(rankiX + rankiSize / 2, rankiY + rankiSize / 2 + bob);
    context.rotate(Math.sin(progress * Math.PI * 3) * .025);
    context.shadowColor = "rgba(0,0,0,.48)";
    context.shadowBlur = 38;
    context.shadowOffsetY = 26;
    drawCover(context, state.rankiImage, -rankiSize / 2, -rankiSize / 2, rankiSize, rankiSize, true);
    context.restore();
  }

  if (scene === 1 && visualProductImage && !hasClip) {
    context.save();
    context.translate(315, 920 + bob * .45);
    context.rotate(-.055 + sceneProgress * .035);
    context.shadowColor = "rgba(0,0,0,.42)";
    context.shadowBlur = 42;
    context.shadowOffsetY = 28;
    roundedRect(context, -245, -250, 490, 500, 38);
    context.fillStyle = "#fff";
    context.fill();
    context.shadowColor = "transparent";
    drawCover(context, visualProductImage, -215, -218, 430, 430, true);
    context.restore();
  }

  if (scene === 2 && !hasClip) {
    context.fillStyle = "rgba(160,255,200,.18)";
    context.beginPath();
    context.ellipse(540, 1300, 420, 85, 0, 0, Math.PI * 2);
    context.fill();
  }

  roundedRect(context, 55, 1260, 970, 335, 40);
  context.fillStyle = "rgba(255,255,255,.96)";
  context.fill();
  if (visualProductImage) drawCover(context, visualProductImage, 78, 1290, 250, 250, true);
  context.fillStyle = "#053c2e";
  context.font = "900 43px system-ui";
  wrapLines(context, product.title, 640, 3).forEach((line, index) => context.fillText(line, 355, 1345 + index * 52));
  context.fillStyle = "#08764f";
  context.font = "750 27px system-ui";
  context.fillText("PREÇO REGISTRADO", 355, 1492);
  context.font = "900 48px system-ui";
  context.fillText(money(product.price), 355, 1550);

  context.fillStyle = "#ffffff";
  context.font = "750 43px system-ui";
  wrapLines(context, subtitleAt(progress), 935, 2).forEach((line, index) => context.fillText(line, 70, 1670 + index * 45));
  context.fillStyle = "#b8f6d6";
  context.font = "800 40px system-ui";
  context.fillText("Veja a análise no Ranking da Compra", 70, 1810);
  context.font = "650 30px system-ui";
  context.fillText("Preço registrado; confirme o valor final no vendedor.", 70, 1857);

  const boundary = (progress * 3) % 1;
  const transition = Math.max(0, 1 - Math.min(boundary, 1 - boundary) * 16);
  if (progress > .01 && progress < .99 && transition > 0) {
    context.fillStyle = `rgba(0,12,10,${transition * .15})`;
    context.fillRect(0, 0, width, height);
  }
}

function drawClassicFrame(context, progress = 0) {
  const canvas = $("video-canvas");
  const width = canvas.width;
  const height = canvas.height;
  const product = state.product || { title: "Escolha um produto", category: "Ranking da Compra", price: 0, pros: [], cons: [] };
  const pulse = Math.sin(progress * Math.PI * 18);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#063f2f");
  gradient.addColorStop(0.55, "#087854");
  gradient.addColorStop(1, "#0eb276");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,.06)";
  for (let index = 0; index < 8; index += 1) {
    context.beginPath();
    context.arc(110 + index * 160, 260 + (index % 2) * 210, 110 + 12 * pulse, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#ffffff";
  context.font = "900 54px system-ui";
  context.fillText("RANKING DA COMPRA", 64, 94);
  context.fillStyle = "#baf5d8";
  context.font = "800 31px system-ui";
  context.fillText("ESCOLHAS MAIS CLARAS", 66, 140);

  roundedRect(context, 62, 205, 956, 790, 46);
  context.fillStyle = "#ffffff";
  context.fill();
  drawCover(context, state.productImage, 105, 250, 870, 660, true);
  context.fillStyle = "#073d2e";
  context.font = "950 36px system-ui";
  context.fillText(compact(product.category, 34).toUpperCase(), 104, 955);

  context.fillStyle = "#ffffff";
  context.font = "950 62px system-ui";
  const titleLines = wrapLines(context, product.title, 900, 3);
  titleLines.forEach((line, index) => context.fillText(line, 70, 1080 + index * 72));

  roundedRect(context, 64, 1318, 952, 220, 34);
  context.fillStyle = "rgba(0,0,0,.22)";
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "800 38px system-ui";
  const subtitleLines = wrapLines(context, subtitleAt(progress), 845, 4);
  subtitleLines.forEach((line, index) => context.fillText(line, 108, 1385 + index * 47));

  const mascotX = 40 + pulse * 5;
  drawCover(context, state.rankiImage, mascotX, 1510, 350, 390, true);
  roundedRect(context, 360, 1590, 655, 205, 32);
  context.fillStyle = "#fff";
  context.fill();
  context.fillStyle = "#08764f";
  context.font = "950 42px system-ui";
  context.fillText("PREÇO INFORMADO", 402, 1650);
  context.fillStyle = "#073d2e";
  context.font = "950 59px system-ui";
  context.fillText(money(product.price), 402, 1725);
  context.fillStyle = "#557067";
  context.font = "750 26px system-ui";
  context.fillText("Confirme preço e estoque no vendedor", 402, 1770);
  context.fillStyle = "#ffffff";
  context.font = "900 30px system-ui";
  context.fillText("rankingdacompra.com.br", 650, 1880);
}

function stopVisualPreview() {
  if (state.previewDrawing) cancelAnimationFrame(state.previewDrawing);
  state.previewDrawing = 0;
  state.sceneVideo?.pause();
  $("preview-animation").textContent = "▶ Ver cenas em movimento";
}

async function previewVisual() {
  if (state.previewDrawing) {
    stopVisualPreview();
    drawFrame(0.08);
    return;
  }
  if (!state.product) return status("video-status", "Escolha um produto para ver a prévia.", "error");
  try {
    if (state.sceneVideo && $("visual-style").value === "cinematic") {
      state.sceneVideo.currentTime = 0;
      await state.sceneVideo.play();
    }
    $("preview-animation").textContent = "■ Parar prévia";
    const startedAt = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / 12000);
      drawFrame(progress);
      if (progress < 1) state.previewDrawing = requestAnimationFrame(animate);
      else {
        stopVisualPreview();
        drawFrame(0.08);
      }
    };
    state.previewDrawing = requestAnimationFrame(animate);
  } catch (error) {
    stopVisualPreview();
    status("video-status", `Não foi possível reproduzir a cena: ${clean(error.message)}`, "error");
  }
}

function bestRecorderMime() {
  return [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function createVideo() {
  if (!state.audioBlob || !state.product) return status("video-status", "Gere e aprove a voz natural primeiro.", "error");
  stopVisualPreview();
  $("create-video").disabled = true;
  status("video-status", "Criando o vídeo vertical. Mantenha esta página aberta...");
  let audioContext;
  let canvasStream;
  let stream;
  try {
    await loadVisualAssets();
    if (!state.productImage && !state.uploadedImages.length) throw new Error("Adicione uma foto do produto para esta montagem.");
    audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(await state.audioBlob.arrayBuffer());
    if (audioBuffer.duration < 10 || audioBuffer.duration > 20) {
      throw new Error(`A narração tem ${audioBuffer.duration.toFixed(1)} s. Ajuste o roteiro para ficar entre 10 e 20 segundos.`);
    }
    if (state.sceneVideo && $("visual-style").value === "cinematic") {
      state.sceneVideo.currentTime = 0;
      await state.sceneVideo.play();
    }
    const source = audioContext.createBufferSource();
    const destination = audioContext.createMediaStreamDestination();
    source.buffer = audioBuffer;
    source.connect(destination);
    drawFrame(0);
    canvasStream = $("video-canvas").captureStream(30);
    stream = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const mimeType = bestRecorderMime();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const done = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (event) => reject(event.error || new Error("Falha ao gravar o vídeo."));
    });
    const startedAt = performance.now();
    const duration = audioBuffer.duration + 0.45;
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / (duration * 1000));
      drawFrame(progress);
      if (progress < 1 && recorder.state === "recording") state.drawing = requestAnimationFrame(animate);
    };
    recorder.start(500);
    source.start();
    state.drawing = requestAnimationFrame(animate);
    source.onended = () => setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 450);
    await done;
    cancelAnimationFrame(state.drawing);
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoMime = recorder.mimeType || mimeType || "video/webm";
    state.videoBlob = new Blob(chunks, { type: state.videoMime });
    state.videoUrl = URL.createObjectURL(state.videoBlob);
    const extension = state.videoMime.includes("mp4") ? "mp4" : "webm";
    const filename = `ranki-${state.product.id}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    $("download-video").href = state.videoUrl;
    $("download-video").download = filename;
    $("download-video").classList.add("on");
    $("upload-youtube").disabled = !currentYouTubeClientId();
    status("video-status", `Vídeo pronto (${(state.videoBlob.size / 1024 / 1024).toFixed(1)} MB, ${extension.toUpperCase()}). Assista após baixar e só então publique.`, "ok");
  } catch (error) {
    console.error(error);
    status("video-status", `Não foi possível criar o vídeo: ${clean(error?.message || error)}`, "error");
  } finally {
    cancelAnimationFrame(state.drawing);
    state.sceneVideo?.pause();
    canvasStream?.getTracks().forEach((track) => track.stop());
    stream?.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
    $("create-video").disabled = !state.audioBlob || state.audioDuration < 10 || state.audioDuration > 20;
  }
}

function currentYouTubeClientId() {
  return safeYouTubeClientId($("youtube-client-id").value || localStorage.getItem(YOUTUBE_CLIENT_KEY));
}

function waitForGoogleIdentity(timeout = 12000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start > timeout) return reject(new Error("O login do Google não carregou."));
      setTimeout(check, 200);
    };
    check();
  });
}

async function getYouTubeToken(clientId) {
  await waitForGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/youtube.upload",
      callback: (response) => response?.access_token ? resolve(response.access_token) : reject(new Error(response?.error || "Autorização do YouTube recusada.")),
      error_callback: (error) => reject(new Error(error?.message || error?.type || "A janela do Google foi fechada."))
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

async function uploadYouTube() {
  const clientId = currentYouTubeClientId();
  if (!state.videoBlob) return status("youtube-status", "Crie o vídeo primeiro.", "error");
  if (!clientId) return status("youtube-status", "Informe um Client ID OAuth válido na configuração abaixo.", "error");
  $("upload-youtube").disabled = true;
  status("youtube-status", "Aguardando sua autorização do Google...");
  try {
    const token = await getYouTubeToken(clientId);
    status("youtube-status", "Enviando o vídeo diretamente ao YouTube...");
    const metadata = {
      snippet: {
        title: compact($("video-title").value || state.product.title, 100),
        description: clean($("video-description").value),
        categoryId: "22",
        tags: ["Ranking da Compra", "Ranki", "produtos", "ofertas", "Shorts"]
      },
      status: {
        privacyStatus: $("privacy").value,
        selfDeclaredMadeForKids: $("made-for-kids").value === "true"
      }
    };
    const session = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(state.videoBlob.size),
        "X-Upload-Content-Type": state.videoMime || state.videoBlob.type
      },
      body: JSON.stringify(metadata)
    });
    if (!session.ok) throw new Error(`O YouTube recusou o início do envio (${session.status}): ${compact(await session.text(), 220)}`);
    const uploadUrl = session.headers.get("Location");
    if (!uploadUrl) throw new Error("O YouTube não devolveu o endereço de envio.");
    const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": state.videoMime || state.videoBlob.type }, body: state.videoBlob });
    if (!upload.ok) throw new Error(`Falha durante o envio (${upload.status}): ${compact(await upload.text(), 220)}`);
    const video = await upload.json();
    const videoId = clean(video.id);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("O YouTube não devolveu um identificador válido.");
    const videoUrl = `https://youtu.be/${videoId}`;
    let saved = true;
    try {
      await setDoc(doc(db, "produtos", state.product.id), {
        youtubeVideoId: videoId,
        youtubeVideoUrl: videoUrl,
        youtubeTitulo: metadata.snippet.title,
        youtubePrivacidade: clean(video?.status?.privacyStatus || metadata.status.privacyStatus),
        youtubePublicadoEm: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      saved = false;
      console.warn("Vídeo enviado, mas o endereço não pôde ser salvo no produto.", error);
    }
    status("youtube-status", `Vídeo enviado${saved ? " e ligado ao produto" : ""}: ${videoUrl}. ${saved ? "Execute a criação das páginas para incorporá-lo à análise." : "Copie o endereço antes de sair."}`, "ok");
  } catch (error) {
    console.error(error);
    status("youtube-status", `Não foi possível enviar: ${clean(error?.message || error)}`, "error");
  } finally {
    $("upload-youtube").disabled = !state.videoBlob || !currentYouTubeClientId();
  }
}

function saveClientId() {
  const clientId = safeYouTubeClientId($("youtube-client-id").value);
  if (!clientId) return status("youtube-status", "Client ID inválido. Ele deve terminar em .apps.googleusercontent.com.", "error");
  localStorage.setItem(YOUTUBE_CLIENT_KEY, clientId);
  $("upload-youtube").disabled = !state.videoBlob;
  status("youtube-status", "Client ID salvo somente neste aparelho. Nenhuma senha foi armazenada.", "ok");
}

function bindEvents() {
  $("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    status("login-status", "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, $("email").value, $("password").value);
    } catch (error) {
      status("login-status", `Não foi possível entrar: ${clean(error?.message || error)}`, "error");
    }
  });
  $("logout").onclick = () => signOut(auth);
  $("product-search").oninput = (event) => {
    const term = normalize(event.target.value);
    state.filtered = !term ? state.catalog : state.catalog.filter((item) => normalize(`${item.title} ${item.category}`).includes(term));
    renderProducts();
  };
  $("product").onchange = async (event) => {
    if (!event.target.value) return;
    try { await loadProduct(event.target.value); }
    catch (error) { status("catalog-status", `Não foi possível abrir o produto: ${clean(error?.message || error)}`, "error"); }
  };
  $("prepare-script").onclick = prepareScript;
  $("video-type").onchange = () => { if (state.product) prepareScript(); };
  $("ranki-theme").onchange = async () => { if (state.product) { await loadVisualAssets(); invalidateVideo(); drawFrame(0.08); } };
  $("visual-style").onchange = () => { invalidateVideo(); drawFrame(0.08); };
  $("product-images").onchange = async (event) => loadProductImages([...event.target.files]);
  $("clear-product-images").onclick = clearProductImages;
  $("scene-video").onchange = async (event) => loadSceneVideo(event.target.files?.[0]);
  $("clear-scene-video").onclick = () => { clearSceneVideo(); invalidateVideo(); };
  $("script").oninput = () => { updateScriptCount(); invalidateMedia(); $("generate-voice").disabled = clean($("script").value).length < 80; drawFrame(0.08); };
  $("voice").onchange = () => { invalidateMedia(); $("generate-voice").disabled = clean($("script").value).length < 80; };
  $("browser-preview").onclick = browserPreview;
  $("generate-voice").onclick = generateVoice;
  $("preview-animation").onclick = previewVisual;
  $("create-video").onclick = createVideo;
  $("save-client-id").onclick = saveClientId;
  $("upload-youtube").onclick = uploadYouTube;
}

bindEvents();
$("youtube-client-id").value = localStorage.getItem(YOUTUBE_CLIENT_KEY) || "";
drawFrame(0);

onAuthStateChanged(auth, async (user) => {
  $("login").classList.toggle("hidden", Boolean(user));
  $("studio").classList.toggle("hidden", !user);
  $("logout").classList.toggle("hidden", !user);
  if (user && !state.catalog.length) {
    try { await loadCatalog(); }
    catch (error) { status("catalog-status", `Não foi possível carregar o catálogo: ${clean(error?.message || error)}`, "error"); }
  }
});

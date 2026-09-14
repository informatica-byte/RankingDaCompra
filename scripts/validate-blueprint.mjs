import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const blueprintPath = resolve("docs/PLANTA-MESTRA.md");
const manifestPath = resolve("docs/planta-mestra.json");
const errors = [];

function fail(message) {
  errors.push(message);
}

async function mustExist(path, label = path) {
  try {
    await access(resolve(path));
  } catch {
    fail(`${label}: arquivo obrigatório ausente (${path})`);
  }
}

let blueprint = "";
let manifest;
try {
  blueprint = await readFile(blueprintPath, "utf8");
} catch {
  fail("docs/PLANTA-MESTRA.md não pôde ser lido");
}

try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  fail(`docs/planta-mestra.json inválido: ${error.message}`);
}

const requiredSections = [
  "## 3. Arquitetura geral",
  "## 5. Mapa de rotas e telas",
  "## 7. Modelo de dados",
  "## 9. Fluxos operacionais",
  "## 11. Integrações e segredos",
  "## 13. Plano de backup que permite reconstrução real",
  "## 14. Reconstrução do zero",
  "## 15. Validação e critérios de aceite",
  "## 16. Procedimento obrigatório para qualquer IA"
];

for (const section of requiredSections) {
  if (!blueprint.includes(section)) fail(`planta humana sem seção obrigatória: ${section}`);
}

if (!blueprint.includes("informatica-byte/RankingDaCompra")) fail("repositório oficial ausente da planta humana");
if (!blueprint.includes("https://rankingdacompra.com.br/")) fail("domínio oficial ausente da planta humana");
if (!blueprint.includes("regras e índices do Firestore")) fail("lacuna de backup do Firestore não está documentada");

if (manifest) {
  if (manifest.schemaVersion !== 1) fail("schemaVersion do manifesto precisa ser 1");
  if (manifest?.project?.repository !== "informatica-byte/RankingDaCompra") fail("repositório incorreto no manifesto");
  if (manifest?.project?.branch !== "main") fail("branch oficial incorreta no manifesto");
  if (manifest?.project?.domain !== "https://rankingdacompra.com.br/") fail("domínio incorreto no manifesto");

  const paths = [
    ...(manifest.entrypoints || []).map((item) => item.path),
    ...(manifest.publicModules || []),
    ...(manifest.workflows || []).map((item) => item.path),
    ...(manifest.automationScripts || [])
  ];
  for (const path of new Set(paths)) await mustExist(path, "manifesto");

  const secrets = new Set(manifest.githubSecretNames || []);
  for (const name of [
    "MERCADO_LIVRE_ACCESS_TOKEN",
    "MERCADO_LIVRE_CLIENT_ID",
    "MERCADO_LIVRE_CLIENT_SECRET",
    "MERCADO_LIVRE_TOKEN_KEY",
    "MERCADO_LIVRE_AUTHORIZATION_CODE"
  ]) {
    if (!secrets.has(name)) fail(`segredo obrigatório ausente do inventário: ${name}`);
  }

  const forbiddenManifestKeys = /"(?:secretValue|password|privateKey|accessTokenValue)"\s*:/i;
  const rawManifest = await readFile(manifestPath, "utf8");
  if (forbiddenManifestKeys.test(rawManifest)) fail("o manifesto parece conter valor secreto em vez de apenas o nome");
}

if (errors.length) {
  console.error("\nValidação da planta bloqueou a publicação:");
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log("Planta validada: documentação humana, manifesto e arquivos essenciais estão coerentes.");

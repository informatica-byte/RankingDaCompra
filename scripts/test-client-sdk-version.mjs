import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const clients=['index.html','dashboard.html','painel-celular.html','growth-tools.js','mlb-localizador.js','ranki-video-studio.js'];
test('todos os clientes usam a mesma versão 12 do Firebase, sem mistura compat/modular',()=>{
 for(const file of clients){
  const text=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const versions=[...text.matchAll(/www\.gstatic\.com\/firebasejs\/([^/]+)\//g)].map(m=>m[1]);
  assert.ok(versions.length,file+' precisa declarar a dependência');
  assert.deepEqual([...new Set(versions)],['12.19.0'],file);
  assert.doesNotMatch(text,/getImagenModel|generateImages\(/,file+' não deve depender de APIs Imagen removidas');
 }
});
test('atualização do SDK não remove o provedor explícito do App Check nem altera regras',()=>{
 for(const file of ['painel-celular.html','dashboard.html','ranki-video-studio.js']){
  const text=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(text,/ReCaptchaEnterpriseProvider/,file);
  assert.doesNotMatch(text,/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=\s*true/,file);
 }
});

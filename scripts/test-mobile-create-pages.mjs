import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../painel-celular.html',import.meta.url),'utf8');
const block=html.match(/<div class="express-page-actions"[^>]*>([\s\S]*?)<\/div>/)?.[1];
test('atalho de criar páginas fica no bloco da publicação expressa, antes da revisão',()=>{assert.ok(block);const start=html.indexOf('<div class="etapa">Publicação expressa</div>'),button=html.indexOf('id="express-criar-paginas"'),review=html.indexOf('<form id="preview"');assert.ok(start<button&&button<review);assert.equal((html.match(/id="express-criar-paginas"/g)||[]).length,1);});
test('reutiliza workflow existente em aba separada, sem salvar ou enviar dados do formulário',()=>{assert.match(block,/<a id="express-criar-paginas"[^>]*href="https:\/\/github\.com\/informatica-byte\/RankingDaCompra\/actions\/workflows\/update-sitemap\.yml"/);assert.match(block,/target="_blank" rel="noopener noreferrer"/);assert.doesNotMatch(block,/onclick|fetch\(|addDoc|setDoc|updateDoc|token|api\.github|\/dispatches/);});
test('orientação distingue salvar cadastro de criar páginas e informa a execução manual',()=>{assert.match(block,/Use depois de salvar/);assert.match(block,/main/);assert.match(block,/Run workflow \/ Executar fluxo de trabalho/);assert.match(block,/não salva o formulário nem duplica cadastros/);assert.match(block,/aria-describedby="express-criar-paginas-ajuda"/);});

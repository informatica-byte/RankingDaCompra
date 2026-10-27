import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FEATURED_ANALYSES,CONFIG,improveProduct,resolveEditorialProduct} from './visibility-editorial.mjs';
import {affiliateLinks,informationalHtml,assertInformationalHtml} from './informational-site.mjs';
const root=new URL('..',import.meta.url);
const json=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));

test('todos os sete destaques têm perfil, vantagens, limites e perguntas específicas',async()=>{
 const ids=(await json('site-config.json')).bestChoicesProductIds;
 assert.equal(FEATURED_ANALYSES.products.length,7);
 for(const id of ids){const item=FEATURED_ANALYSES.products.find(x=>x.id===id);assert.ok(item,'destaque ausente: '+id);assert.ok(item.fit.length>80);assert.ok(item.tradeoff.length>80);assert.ok(item.advantages.length>=2);assert.ok(item.limitations.length>=2);assert.ok(item.questions.length>=4);assert.ok(item.basis.length>50);assert.ok(item.sources.length);}
});

test('as análises profundas preservam identidade, canonical, links e ausência de preço',async()=>{
 for(const item of CONFIG.products.filter(x=>x.depth)){
  const page=await resolveEditorialProduct(decodeURIComponent(root.pathname.replace(/^\/([A-Z]:)/,'$1')),item);
  assert.equal(page.inactive,false);
  const out=informationalHtml(improveProduct(page.html,item),{id:item.id},page.file);
  assert.deepEqual(affiliateLinks(out),affiliateLinks(page.html));
  assertInformationalHtml(out,page.file);assert.match(out,/data-reviewed-depth=/);assert.match(out,/Dúvidas frequentes sobre este modelo/);
  assert.equal((out.match(/visibility-editorial:start/g)||[]).length,1);
  assert.doesNotMatch(out,/data-informational-faq/,'não duplicar FAQ automática e perguntas revisadas');
  assert.equal(informationalHtml(improveProduct(out,item),{id:item.id},page.file),out);
 }
});

test('ASUS e conversor não ganham confirmação indevida, desempenho ou compatibilidade',()=>{
 const asus=FEATURED_ANALYSES.products.find(x=>x.id==='O6e0R2WtiZfyyf2MJe5Y');
 assert.match(asus.basis,/Ryzen 5 40/);assert.match(asus.basis,/7520U/);assert.match(asus.basis,/sem nova leitura automática/);
 const converter=FEATURED_ANALYSES.products.find(x=>x.id==='mlMLB4952988337');
 assert.match(converter.basis,/Não obtivemos manual/);assert.ok(converter.questions.some(([q,a])=>/Starlink/.test(q)&&/não foi confirmada/.test(a)));
 for(const item of FEATURED_ANALYSES.products){const text=JSON.stringify(item);assert.doesNotMatch(text,/R\$|"(?:price|preco|rating|nota|linkAfiliado)"\s*:/);}
});

test('campos adicionais são escapados e fontes parecidas ou com credenciais não entram',async()=>{
 const item=CONFIG.products.find(x=>x.depth),page=await resolveEditorialProduct(decodeURIComponent(root.pathname.replace(/^\/([A-Z]:)/,'$1')),item);
 const out=improveProduct(page.html,{...item,basis:'<img onerror=1>',advantages:['<script>'],questions:[['<svg>','<img>']],sources:[{url:'https://www.mi.com.evil.example/test',label:'falsa'},{url:'https://user:password@www.mi.com/test',label:'credencial'}]});
 assert.match(out,/&lt;script&gt;/);assert.match(out,/&lt;svg&gt;/);assert.doesNotMatch(out,/href="https:\/\/(?:www\.mi\.com\.evil|user:password)/);
});

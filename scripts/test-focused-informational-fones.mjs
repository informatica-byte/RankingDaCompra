import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FOCUSED_GUIDES,focusedProducts} from './discovery-editorial.mjs';
import {renderIntegrityGuide} from './comparison-guides.mjs';
import {informationalHtml,assertInformationalHtml} from './informational-site.mjs';
const config=FOCUSED_GUIDES.find(x=>x.file==='melhores-fones-bluetooth-ate-100.html'),site='https://rankingdacompra.com.br/';
const records=[['redmi','Fone Bluetooth Redmi Buds 6 Play Preto'],['redmi-blue','Fone Bluetooth Redmi Buds 6 Play Azul'],['jbl','Fone Bluetooth JBL Tune 520BT'],['unknown','Fone Bluetooth Modelo anunciado'],['wired','Fone com fio P2'],['mic','Microfone sem fio Bluetooth'],['lapela','Microfone Lapela sem fio Bluetooth'],['case','Capa para Fone Bluetooth'],['pads','Almofadas para Headphone Bluetooth']].map(([id,titulo])=>({id,titulo,linkAfiliado:'https://meli.la/'+id}));

test('guia de fones mantém a URL histórica, dispensa preços e não seleciona microfones ou acessórios',()=>{
 const before=JSON.stringify(records);const selected=focusedProducts(config,records,()=>{throw Error('Não pode exigir preço');});
 assert.deepEqual(selected.map(p=>p.id),['redmi','redmi-blue','jbl','unknown']);assert.equal(config.budget,undefined);assert.doesNotMatch(config.title+' '+config.intro,/R\$|até 100|dentro desse teto/);
 const urls=new Map(records.map(p=>[p.id,site+'produto/'+p.id+'.html']));
 const raw=renderIntegrityGuide({file:config.file,title:config.title,description:config.intro,products:selected,urls,date:'2026-10-27',focused:true,parentFile:'melhores-fones-de-ouvido.html'});
 const html=informationalHtml(raw,null,config.file);assertInformationalHtml(html,config.file);
 assert.ok(html.includes('<link rel="canonical" href="'+site+config.file+'">'));
 for(const type of ['earbuds-tws','headphones-on-wireless','unconfirmed'])assert.ok(html.includes('data-comparison-type="'+type+'"'),type);
 assert.equal((html.match(/data-comparison-product="redmi(?:-blue)?"/g)||[]).length,1,'cores do mesmo modelo não disputam posições');
 assert.match(html,/redmi-blue\.html/);assert.match(html,/a confirmar/i);assert.match(html,/Sem vencedor artificial/);
 assert.equal(JSON.stringify(records),before,'não altera links ou cadastros');
});

test('regressão do workflow: páginas informativas sem Offer/price geram o comparativo completo',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'rdc-focused-info-'));
 try{
  await mkdir(join(directory,'produto'));const paths=[];
  for(const p of records){
   const url=site+'produto/'+p.id+'-20260810-1.html';paths.push(url);
   const summary='Análise informativa com características anunciadas, diferenças de formato, limitações e dúvidas ainda sem confirmação. Consulte a versão exata, as fontes dos recursos informados, a compatibilidade e as condições da loja parceira antes de decidir.';
   const html='<!doctype html><html><head><meta name="rdc-site-mode" content="informational"><meta name="robots" content="index,follow"><link rel="canonical" href="'+url+'"><meta property="og:image" content="'+site+'assets/logo.png"><script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:p.titulo})+'</script></head><body><h1>'+p.titulo+'</h1><p class="summary">'+summary+'</p><div class="fact"><span>Categoria</span>Fones de ouvido</div><a id="affiliate-offer" href="'+p.linkAfiliado+'">Conferir na loja</a></body></html>';
   await writeFile(join(directory,'produto',p.id+'-20260810-1.html'),html);
  }
  await writeFile(join(directory,'sitemap.xml'),'<urlset>'+paths.map(url=>'<url><loc>'+url+'</loc></url>').join('')+'</urlset>');
  const denyNetwork='let calls=0;globalThis.fetch=async()=>{calls++;throw Error("NETWORK_DISABLED_IN_FIXTURE")};process.on("exit",()=>{if(calls)process.exitCode=92});';
  const result=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(denyNetwork),fileURLToPath(new URL('./generate-discovery.mjs',import.meta.url))],{cwd:directory,env:{...process.env,DISCOVERY_FIXTURE:'',DISCOVERY_USE_GENERATED:'true'},encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  const html=informationalHtml(await readFile(join(directory,config.file),'utf8'),null,config.file);assertInformationalHtml(html,config.file);
  assert.match(html,/data-comparison-type=/);assert.match(html,/data-comparison-product="jbl"/);assert.match(html,/data-comparison-product="unknown"/);
  assert.doesNotMatch(html,/data-comparison-product="(?:mic|lapela|case|pads|wired)"/);assert.match(html,/Fones Bluetooth: compare formatos, recursos e limitações/);
  const sitemap=await readFile(join(directory,'sitemap.xml'),'utf8');assert.ok(sitemap.includes(site+config.file));for(const url of paths)assert.ok(sitemap.includes(url),'preserva a análise original');
  assert.match(result.stdout,/análises pesquisáveis sem Firebase/,'reutiliza HTML sem ler o Firebase');
 }finally{await rm(directory,{recursive:true,force:true});}
});

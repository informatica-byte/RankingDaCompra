// Record a small editorial batch only after production and CI evidence exists.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const [batch,date,source,pagesRunId]=process.argv.slice(2);assert.match(batch||'',/^\d+$/);assert.match(date||'',/^\d{8}$/);assert.match(source||'',/^[a-f0-9]{40}$/);if(pagesRunId)assert.match(pagesRunId,/^\d+$/);
const out='../../outputs/melhorias-integrais-20261030/',json=async f=>JSON.parse(await readFile(f,'utf8'));
const p=await json('docs/site-improvement-progress.json'),manifest=await json(`docs/targeted-triage${batch}-${date}.json`),proof=await json(out+`verificacao-publicada-triagem${batch}.json`);
const changed=manifest.items.filter(x=>x.decision==='targeted_correction_complete').map(x=>x.id).sort();
assert.equal(p['triage'+batch].status,'published_verified');assert.deepEqual(proof.changedIds,changed);assert.equal(proof.deepReviews,98);
const tests=await readFile(out+`testes-triagem${batch}.log`,'utf8');assert.match(tests,/ℹ fail 0/);const passed=Number(tests.match(/ℹ pass (\d+)/)?.[1]);assert.ok(passed>0);
const qa=await json(out+`qa-triagem${batch}.log`);assert.equal(qa.checked.length,manifest.items.length*2);assert.ok(qa.checked.every(x=>x.passed));
const api='https://api.github.com/repos/informatica-byte/RankingDaCompra/actions/runs';
const getRunData=async url=>{const r=await fetch(url);assert.ok(r.ok);return r.json();};
// Resuming a prior day's checkpoint must not depend on its runs remaining in the latest eight.
const {workflow_runs:runs}=await getRunData(api+'?head_sha='+source+'&per_page=8');
const sitemap=runs.find(x=>x.name==='Atualizar sitemap automaticamente'&&x.head_sha===source),integrity=runs.find(x=>x.name==='Validar integridade do site'&&x.head_sha===source);
const pages=pagesRunId?await getRunData(api+'/'+pagesRunId):(await getRunData(api+'?per_page=8')).workflow_runs.find(x=>x.name==='pages build and deployment'&&x.conclusion==='success'&&new Date(x.created_at)>=new Date(sitemap?.created_at));
assert.equal(pages?.name,'pages build and deployment');assert.equal(pages?.conclusion,'success');assert.ok(new Date(pages.created_at)>=new Date(sitemap?.created_at));
assert.equal(sitemap?.conclusion,'success');assert.equal(integrity?.conclusion,'success');assert.ok(pages);
p['triage'+batch]={...p['triage'+batch],sourceCommit:source,generatedCommit:pages.head_sha,sitemapRun:sitemap.id,integrityRun:integrity.id,pagesRun:pages.id,testsPassed:passed,localMobileChecks:qa.checked.length,backendWrites:0};
const next=p.editorialPriority.nextPendingIds.slice(0,3).map(id=>p.items.find(x=>x.id===id)).map(x=>({id:x.id,title:x.title}));
const header='# Continuidade prioritária — Ranking da Compra\n';let doc=(await readFile('docs/site-improvement-continuity.md','utf8')).replace(/\r\n/g,'\n');assert.ok(doc.startsWith(header));
const details=manifest.items.map(x=>`- ${x.id}: ${x.decision}. ${x.reason} Limite: ${x.sourceLimit}`).join('\n');
const note=`## Passagem ${batch} — ${date}, PUBLICADA E VERIFICADA\n\n${details}\n\nFonte ${source}; geração ${pages.head_sha}; sitemap ${sitemap.id}, integridade ${integrity.id}, Pages ${pages.id}: SUCCESS. ${passed} testes, validate-site e invariantes aprovados. ${changed.length} fichas publicadas HTTP200; ${proof.unchangedProducts} entradas editoriais inalteradas. Preservados ${proof.products} IDs/afiliados/campos operacionais e ${proof.sitemapUrls} URLs; histórico comparado por hash durante preparação. ${qa.checked.length} verificações estáticas 360/390 px, requests externos bloqueados: não celular físico nem teste de produto. Sem Firestore, conferência diária, exclusão, união ou preços/afiliados alterados. Prova outputs/melhorias-integrais-20261030/verificacao-publicada-triagem${batch}.json.\n\nTotais: ${JSON.stringify(p.counts)}. Próximos pendentes: ${next.map(x=>x.id+' — '+x.title).join('; ')}. Não repetir estes IDs ou as 98 análises profundas. Fila GA4 salva 01–28/10, não demanda atual comprovada. Checkpoint final local, sem push documental extra.\n\n`;
doc=header+note+doc.slice(header.length);
await writeFile('docs/site-improvement-progress.json',JSON.stringify(p,null,2)+'\n');await writeFile('docs/site-improvement-continuity.md',doc);await writeFile(out+'PROGRESSO-POR-PRODUTO.json',JSON.stringify(p,null,2)+'\n');await writeFile(out+'CONTINUIDADE.md',doc);
console.log(JSON.stringify({counts:p.counts,next,publication:p['triage'+batch]}));

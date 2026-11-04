import {readFile,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {refreshLedger} from './site-improvement-ledger.mjs';
const {flags}=createRequire(import.meta.url)('../editorial-ai-policy.js'),json=async p=>JSON.parse(await readFile(p,'utf8'));
const c=await json('informational-catalogue.json'),p=refreshLedger(c,await json('docs/site-improvement-progress.json')),views=new Map();
try{const traffic=await json('../../outputs/melhorias-integrais-20261030/ga4-prioridade-visualizacoes-20261031.json');for(const r of traffic.response.data){const id=r.page_path.match(/^\/produto\/([^/]+)-20260810-1\.html$/)?.[1];if(id)views.set(id,(views.get(id)||0)+Number(r.screen_page_views));}}
catch(e){if(e.code!=='ENOENT')throw e;const previous=await json('editorial-review-queue.json');previous.items.forEach((x,i)=>views.set(x.id,previous.items.length-i));}
const ledger=new Map(p.items.map(x=>[x.id,x])),done=new Set(['targeted_correction_complete','preserve_prior_review','screened_no_change']);
const items=c.products.flatMap(x=>{const previous=ledger.get(x.id),found=flags([x.title,x.summary,...Object.values(x.comparison||{})].join(' '));if(done.has(previous?.status))return [];return [{id:x.id,title:x.title,url:x.url,state:previous?.status==='needs_source'?'needs_source':found.length?'flagged':'screening',reasons:found.map(f=>f.code+': '+f.excerpt)}];}).sort((a,b)=>(views.get(b.id)||0)-(views.get(a.id)||0)||a.id.localeCompare(b.id));
const result={version:1,generatedAt:new Date().toISOString(),priorityWindow:'GA4 salva 01–28/10/2026; não demanda atual nem vendas',limits:'Triagem heurística, não diagnóstico completo. Fichas concluídas e inalteradas preservadas. Sem métricas brutas, preços, credenciais ou links de afiliados.',counts:items.reduce((a,x)=>(a[x.state]=(a[x.state]||0)+1,a),{}),items};
result.generatedAt=c.generatedAt;
await writeFile('editorial-review-queue.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({counts:result.counts,total:items.length}));

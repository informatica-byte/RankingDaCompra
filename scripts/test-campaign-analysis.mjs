import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CAMPAIGN_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG} from './visibility-editorial.mjs';
test('cinco fichas de campanha têm limites, dúvidas e fontes, sem métricas de procura inventadas',()=>{
  assert.equal(CAMPAIGN_ANALYSES.products.length,5);
  for(const p of CAMPAIGN_ANALYSES.products){
    assert.ok(p.questions.length>=4);
    assert.ok(p.limitations.length>=2);
    assert.ok(p.sources.length);
    assert.equal(p.views,undefined);
    assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
    assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"linkAfiliado"\s*:/);
  }
});
test('revisões da campanha correspondem ao anúncio registrado e estão visíveis nas fichas',async()=>{
  for(const p of CAMPAIGN_ANALYSES.products){
    const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
    const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j];});
    const fullName=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
    assert.ok(fullName,p.id+': identidade completa, sem depender do título visual truncado');
    assert.equal(matchesPopularAnalysis(p,fullName,registeredOfferUrl(html)),true,p.id);
    assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);
    assert.ok(html.includes('30/10/2026'),p.id);
  }
});

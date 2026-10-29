import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import progress from '../affiliate-link-progress.js';
test('ritmo adaptativo reduz só a espera entre resultados confirmados',()=>{
 for(const status of ['available','unavailable'])assert.equal(progress.pacing({status,elapsedMs:1000}).wait,2000);
 assert.equal(progress.pacing({status:'available'},{mode:'careful'}).wait,5000);
});
test('inconclusivos e lentidão elevam a espera; três confirmações recuperam o ritmo',()=>{
 let p=progress.pacing({status:'unverified'});assert.equal(p.wait,10000);assert.equal(p.slow,3);
 for(let i=0;i<3;i++){p=progress.pacing({status:'available',elapsedMs:1000},p);assert.equal(p.wait,5000);}
 assert.equal(progress.pacing({status:'available'},p).wait,2000);
 assert.equal(progress.pacing({status:'available',elapsedMs:15000}).wait,5000);
 assert.equal(progress.pacing({status:'error'}).wait,10000);
});
test('segurança e login não agendam espera nem tentativas e conservam retomada lenta',()=>{
 for(const status of ['security','login']){const p=progress.pacing({status});assert.equal(p.wait,0);assert.equal(p.slow,3);assert.equal(progress.pacing({status:'available'},p).wait,5000);}
});
test('a cada vinte confirmações há pausa maior; entradas estranhas não removem limites',()=>{
 let p={};for(let i=0;i<20;i++)p=progress.pacing({status:'available'},p);assert.equal(p.wait,5000);assert.equal(p.clean,0);
 for(const previous of [{mode:'zero',slow:-100,clean:99},{slow:Infinity,clean:NaN}])assert.ok(progress.pacing({status:'available'},previous).wait>=2000);
});
test('ritmo não modifica resultado, cursor, produto ou links',()=>{
 const value=Object.freeze({status:'available',elapsedMs:4000,affiliateUrl:'https://meli.la/original',preco:123}),prior=Object.freeze({mode:'adaptive',slow:0,clean:1,cursor:40});progress.pacing(value,prior);assert.equal(value.preco,123);assert.equal(prior.cursor,40);assert.equal(value.affiliateUrl,'https://meli.la/original');
});
test('painel usa ritmo depois de persistir e pausar, sem alterar o critério do robô',async()=>{
 const p=await readFile(new URL('../affiliate-link-panel.js',import.meta.url),'utf8');assert.match(p,/data-audit-pace/);assert.match(p,/slow:continuing\?3:0/);
 assert.ok(p.indexOf('if(paused||progress.state')<p.indexOf('pace=checkpoint.pacing'));
 assert.match(p,/setTimeout\(r,pace\.wait\)/);assert.doesNotMatch(p,/setTimeout\(r,5000\)/);
});

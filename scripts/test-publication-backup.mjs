import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationBackup } from './publication-backup.mjs';
const now=Date.parse('2026-10-12T18:00:00Z');
const backup=()=>({format:'rankingdacompra-backup-v1',exportedAt:new Date(now).toISOString(),siteConfig:{},products:[{id:'p',data:{preco:99,precoConferidoEm:{__rdc_type:'timestamp',seconds:1791828000,nanoseconds:0}}}],categories:[{id:'c',data:{nome:'Casa'}}],configurations:[{id:'site',data:{bestChoicesProductIds:['p']}},{id:'ranking-semanal',data:{publicado:false}}]});
test('publicação reaproveita valores e datas reais, sem restaurar o banco',()=>{const b=backup(),p=publicationBackup(b,now);assert.equal(p.products[0].preco,99);assert.equal(p.products[0].precoConferidoEm,'2026-10-12T18:00:00.000Z');assert.deepEqual(p.site.bestChoicesProductIds,['p']);assert.equal(typeof b.products[0].data.precoConferidoEm,'object');});
test('cópias incompletas, antigas ou futuras bloqueiam a publicação',()=>{for(const age of [3600001,-300001]){const b=backup();b.exportedAt=new Date(now-age).toISOString();assert.throws(()=>publicationBackup(b,now));}const b=backup();delete b.configurations;assert.throws(()=>publicationBackup(b,now));});

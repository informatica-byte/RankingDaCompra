import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('liberação conjunta usa o snapshot original sem retirar guardas de preço, afiliado ou URL',async()=>{
 const s=await readFile(new URL('./verify-targeted-editorial.mjs',import.meta.url),'utf8');
 assert.ok(s.includes("out+'invariantes-triagem'+batches[0]+'.json'"));
 for(const guard of ['assert.deepEqual(affiliates,baseline.pages','assert.deepEqual(protectedData,baseline.protectedData)','assert.deepEqual(urls,baseline.urls)','assert.deepEqual(byId.get(id),p'])assert.ok(s.includes(guard),guard);
});
test('liberação parcial preserva conclusão existente e só completa itens preparados',async()=>{
 const s=await readFile(new URL('./verify-targeted-editorial.mjs',import.meta.url),'utf8');
 assert.ok(s.includes('if(i.status===d.decision)continue;'));
 assert.ok(s.includes("assert.equal(i.status,'prepared_awaiting_publication'"));
 assert.ok(s.includes('confirmedPublishedIds:ids,pendingPublicationIds:[]'));
});

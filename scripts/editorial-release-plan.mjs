import assert from 'node:assert/strict';
export function parseReleaseBatches(value){
 assert.match(value||'',/^[1-9]\d*(?:,[1-9]\d*)*$/,'Use ordered batch numbers.');
 const ids=value.split(',').map(Number);assert.deepEqual(ids,[...new Set(ids)].sort((a,b)=>a-b),'Batches must be unique and chronological.');return ids;
}
export function combinedEditorialManifest(manifests){
 assert.ok(manifests.length);const items=manifests.flatMap(m=>m.items),ids=items.map(p=>p.id);assert.equal(new Set(ids).size,ids.length,'Do not review or complete an ID twice in one release.');
 return {items,preserveExceptTitleIds:manifests.flatMap(m=>m.preserveExceptTitleIds||[]),preserveExceptTitleAndNeutralFamilyIds:manifests.flatMap(m=>m.preserveExceptTitleAndNeutralFamilyIds||[])};
}
export function assertTitleAndNeutralFamilyChange(before,after){
 assert.equal(before.comparison?.family,'fone-tws');assert.equal(after.comparison?.family,'fone');
 const strip=p=>({...p,title:undefined,comparison:{...p.comparison,family:undefined}});
 assert.deepEqual(strip(after),strip(before),'Neutral family change must preserve every fact, limit and other record field.');
}

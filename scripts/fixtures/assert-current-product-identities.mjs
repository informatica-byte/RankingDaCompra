import assert from 'node:assert/strict';

// Test contract for a changing catalogue, not a historical inventory-size cap.
// Publication eligibility/removal/price guards remain in the existing generator
// and validate-site; the public catalogue must exactly mirror the search IDs.
export function assertCurrentProductIdentities(catalogue,search,source){
 const index=(payload,label)=>{
  assert.ok(Array.isArray(payload?.products),label+': products must be an array');
  const result=new Map();
  for(const p of payload.products){
   assert.ok(typeof p?.id==='string'&&p.id.trim()===p.id&&p.id.length>0,label+': missing or malformed ID');
   assert.ok(!result.has(p.id),label+': duplicate ID '+p.id);
   result.set(p.id,p);
  }
  return result;
 };
 const current=index(catalogue,'informational catalogue'),discovery=index(search,'search'),registered=index(source,'source snapshot');
 assert.ok(current.size>0,'A missing/empty public catalogue must not pass');
 assert.deepEqual([...current.keys()].sort(),[...discovery.keys()].sort(),'Catalogue/search identities differ');
 for(const [id,p] of current){
  assert.ok(registered.has(id),'Unregistered public ID '+id);
  assert.ok(typeof p.url==='string'&&p.url.length>0,'Missing public URL '+id);
  assert.equal(p.url,discovery.get(id).url,'Catalogue/search URL mismatch '+id);
 }
 return {products:current.size};
}

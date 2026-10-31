import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const product=id=>({id,url:'https://rankingdacompra.com.br/produto/'+id+'.html'});
const snapshot=ids=>({products:ids.map(product)});
test('identity contract accepts 551, 552 and later legitimate registrations without a fixed cap',()=>{
 for(const count of [1,551,552,700]){const p=snapshot(Array.from({length:count},(_,i)=>'product_'+i));assert.deepEqual(assertCurrentProductIdentities(p,structuredClone(p),structuredClone(p)),{products:count});}
});
test('identity contract rejects equal-size ID swaps and missing projection records',()=>{
 const p=snapshot(['a','b']),source=snapshot(['a','b','c']);
 assert.throws(()=>assertCurrentProductIdentities(p,snapshot(['a','c']),source),/identities differ/);
 assert.throws(()=>assertCurrentProductIdentities(snapshot(['a']),p,source),/identities differ/);
 assert.throws(()=>assertCurrentProductIdentities(p,snapshot(['a']),source),/identities differ/);
});
test('identity contract rejects duplicates, malformed IDs, empty output, foreign IDs and URL drift',()=>{
 const p=snapshot(['a']);
 for(const position of [0,1,2]){const inputs=[p,p,p].map(x=>structuredClone(x));inputs[position]=snapshot(['a','a']);assert.throws(()=>assertCurrentProductIdentities(...inputs),/duplicate ID/);}
 assert.throws(()=>assertCurrentProductIdentities(snapshot(['']),p,p),/malformed ID/);
 assert.throws(()=>assertCurrentProductIdentities(snapshot([]),snapshot([]),p),/empty/);
 assert.throws(()=>assertCurrentProductIdentities(p,p,snapshot(['other'])),/Unregistered/);
 assert.throws(()=>assertCurrentProductIdentities(p,{products:[{...product('a'),url:'https://example.com/other'}]},p),/URL mismatch/);
});
test('source-only records may remain excluded by the existing eligibility rules, not by an inventory-size test',()=>{
 const visible=snapshot(['a']);assert.deepEqual(assertCurrentProductIdentities(visible,visible,snapshot(['a','paused-or-filtered'])),{products:1});
});

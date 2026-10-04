import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('regras preservam contratos e só restringem identificação do administrador',async()=>{
 const original=await readFile(new URL('../docs/firebase/firestore-baseline-20261004.rules',import.meta.url),'utf8');
 const proposed=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
 assert.equal(proposed.replace("request.auth.uid == 'dRFqpTrb1TSv8dBTF6hJrAMnXx23' && ",''),original);
 assert.match(proposed,/allow write: if isAdmin\(\)/);
 assert.match(proposed,/allow update, delete: if false/);
 const settings=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));
 assert.equal(settings.firestore.rules,'firestore.rules');
 assert.equal('hosting' in settings,false);
 assert.equal('indexes' in settings.firestore,false);
});

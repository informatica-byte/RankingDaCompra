import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("estúdio compartilha a identidade padrão do painel e inicializa App Check antes da IA",()=>{
 const src=readFileSync("ranki-video-studio.js","utf8");
 assert.match(src,/const app = initializeApp\(firebaseConfig\);/);
 assert.ok(src.indexOf("initializeAppCheck(app")<src.indexOf("const ai = getAI(app"));
 assert.match(src,/onAuthStateChanged\(auth/);
});

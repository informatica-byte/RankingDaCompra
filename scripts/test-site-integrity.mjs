import test from "node:test";
import assert from "node:assert/strict";
import { auditOffline, localReference } from "./audit-site-integrity.mjs";
test("todos os HTML, JSON-LD, scripts e destinos internos existem e são válidos", async () => {
 const report=await auditOffline();
 console.log("AUDIT_COUNTS " + JSON.stringify(report.counts));
 assert.deepEqual(report.errors,[]);
});
test("auditoria trata caminhos relativos sem consultar serviços externos",()=>{
 assert.equal(localReference("../ranki.png","presentes/natal.html"),"ranki.png");
 assert.equal(localReference("/presentes/","index.html"),"presentes/index.html");
 assert.equal(localReference("https://evil.test/secret","index.html"),null);
 assert.equal(localReference("#app","index.html"),null);
 assert.equal(localReference("data:image/png;base64,x","index.html"),null);
});

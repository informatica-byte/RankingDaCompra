# Testes locais das regras

Requisitos: Node 24, pnpm 11.25.0 e Java 21. Instale com pnpm install --frozen-lockfile --ignore-scripts nesta pasta. Execute:

    pnpm exec firebase emulators:exec --config ../../firebase.emulator-tests.json --only firestore --project demo-ranking-audit "node --test rules.test.mjs"

Somente o emulador 127.0.0.1:8089 é aceito. Não use tokens, conta de serviço, projeto real ou firebase deploy. O CI usa este comando sem credenciais de produção. Os testes validam permissões, não rate limiting global nem enforcement do App Check.

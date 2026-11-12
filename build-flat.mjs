// ZUNA V21 - os arquivos sao enviados soltos ao GitHub.
// Este script recria as pastas APENAS durante o build da Netlify.
// Nenhuma conta externa, token ou credencial e necessaria para executar o build.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
const origem = process.cwd();
const arquivos = {
  "site__index.html": "web/index.html",
  "site__app.js": "web/app.js",
  "site__style.css": "web/style.css",
  "site__favicon.svg": "web/favicon.svg",
  "site__logo.svg": "web/logo.svg",
  "site__manifest.webmanifest": "web/manifest.webmanifest",
  "site__sw.js": "web/sw.js",
  "site__icon-192.png": "web/icon-192.png",
  "site__icon-512.png": "web/icon-512.png",
  "funcao__api.mjs": "netlify/functions/api.mjs",
  "funcao__cleanup.mjs": "netlify/functions/cleanup.mjs",
  "lib__security.mjs": "netlify/lib/security.mjs",
  "banco__20261111210000_zuna_v21.sql": "netlify/database/migrations/20261111210000_zuna_v21.sql",
  "teste__release.test.mjs": "tests/release.test.mjs",
  "teste__security.test.mjs": "tests/security.test.mjs",
  "teste__api.test.mjs": "tests/api.test.mjs",
  "teste__ui.test.mjs": "tests/ui.test.mjs",
  "ENV_EXEMPLO.txt": ".env.example",
  "GITIGNORE.txt": ".gitignore",
  "CHECKLIST_LANCAMENTO_V21.md": "CHECKLIST_LANCAMENTO_V21.md",
  "MATRIZ_V21.md": "MATRIZ_V21.md",
  "TESTES_V21.md": "TESTES_V21.md"
};
for (const [nomeSolto, caminhoFinal] of Object.entries(arquivos)) {
  const de = join(origem, nomeSolto);
  if (!existsSync(de)) throw new Error(`Arquivo ausente: ${nomeSolto}`);
  const para = resolve(origem, caminhoFinal);
  const relativo = relative(origem, para);
  if (relativo.startsWith('..') || isAbsolute(relativo)) throw new Error('Destino invalido');
  mkdirSync(dirname(para), { recursive: true });
  copyFileSync(de, para);
  console.log(`OK: ${nomeSolto} -> ${caminhoFinal}`);
}
console.log('ZUNA: estrutura para Netlify reconstruida com sucesso.');

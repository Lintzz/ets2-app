// Dashlz servidor/scripts/build-addon.js
// Compila leitor_memoria.node com o node-gyp OFICIAL.
//
// Por que não deixar o npm chamar `node-gyp rebuild` sozinho: o Electron Forge
// traz @electron/node-gyp como dependência transitiva, e ele sequestra
// node_modules/.bin/node-gyp. Nesta máquina esse fork escolhe a toolchain
// clang-cl, que gera um .node corrompido — a compilação "passa" com 0 erros,
// mas todo Napi::Number sai como lixo (valores diferentes a cada execução).
// Resolvendo o caminho do node-gyp real aqui, o .bin deixa de importar.

const { spawnSync } = require("child_process");

function executar(comando, args) {
  const r = spawnSync(comando, args, { stdio: "inherit", shell: false });
  return r.status === 0;
}

let caminhoNodeGyp = null;
try {
  caminhoNodeGyp = require.resolve("node-gyp/bin/node-gyp.js");
} catch {
  /* node-gyp não instalado (ex: npm install --omit=dev) */
}

const ok = caminhoNodeGyp
  ? executar(process.execPath, [caminhoNodeGyp, "rebuild"])
  : executar(process.platform === "win32" ? "npx.cmd" : "npx", [
      "--yes",
      "node-gyp",
      "rebuild",
    ]);

if (!ok) {
  console.error("\nFalha ao compilar o addon nativo leitor_memoria.");
  console.error("No Windows é preciso ter o Visual Studio Build Tools com a");
  console.error('carga de trabalho "Desenvolvimento para desktop com C++".\n');
  process.exit(1);
}

// Dashlz servidor/instalador-plugin.js
// Detecta a instalação do Euro Truck Simulator 2 e instala o PluginETS2.dll na
// pasta de plugins do jogo (criando-a se não existir).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

// Caminho relativo à raiz do jogo até a pasta de plugins do executável x64.
const SUBPASTA_PLUGINS = path.join("bin", "win_x64", "plugins");
const EXECUTAVEL = path.join("bin", "win_x64", "eurotrucks2.exe");
const NOME_DLL = "PluginETS2.dll";

// --- Localização do jogo -----------------------------------------------------

function consultarRegistro(chave, valor) {
  return new Promise((resolve) => {
    execFile(
      "reg",
      ["query", chave, "/v", valor],
      { windowsHide: true },
      (erro, stdout) => {
        if (erro) return resolve(null);
        // Linha no formato:  SteamPath    REG_SZ    C:/Program Files (x86)/Steam
        const m = stdout.match(new RegExp(`${valor}\\s+REG_\\w+\\s+(.+)`, "i"));
        resolve(m ? m[1].trim() : null);
      }
    );
  });
}

// Bibliotecas do Steam ficam listadas em steamapps/libraryfolders.vdf — é assim
// que se acha um jogo instalado num HD diferente do Steam.
function lerBibliotecasSteam(pastaSteam) {
  const bibliotecas = [pastaSteam];
  try {
    const vdf = fs.readFileSync(
      path.join(pastaSteam, "steamapps", "libraryfolders.vdf"),
      "utf8"
    );
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      bibliotecas.push(m[1].replace(/\\\\/g, "\\"));
    }
  } catch {
    /* sem libraryfolders.vdf */
  }
  return [...new Set(bibliotecas)];
}

// Confere se a pasta é mesmo uma instalação do ETS2.
function ehPastaDoJogo(pasta) {
  try {
    return fs.existsSync(path.join(pasta, EXECUTAVEL));
  } catch {
    return false;
  }
}

// Devolve todos os caminhos plausíveis do ETS2 nesta máquina.
async function detectarPastasETS2() {
  const candidatos = [];

  const pastaSteam =
    (await consultarRegistro("HKCU\\SOFTWARE\\Valve\\Steam", "SteamPath")) ||
    (await consultarRegistro("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"));

  const bases = [];
  if (pastaSteam) bases.push(...lerBibliotecasSteam(pastaSteam.replace(/\//g, "\\")));

  // Locais comuns, caso o registro não ajude.
  bases.push(
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    "D:\\Steam",
    "D:\\SteamLibrary",
    "E:\\Steam",
    "E:\\SteamLibrary"
  );

  for (const base of [...new Set(bases)]) {
    const alvo = path.join(base, "steamapps", "common", "Euro Truck Simulator 2");
    if (ehPastaDoJogo(alvo)) candidatos.push(alvo);
  }

  return [...new Set(candidatos)];
}

// --- Instalação --------------------------------------------------------------

function hashArquivo(caminho) {
  try {
    return crypto.createHash("md5").update(fs.readFileSync(caminho)).digest("hex");
  } catch {
    return null;
  }
}

// Estado da instalação: se o plugin já está lá e se é a mesma versão que
// acompanha este servidor.
function statusInstalacao(pastaJogo, dllDeOrigem) {
  if (!pastaJogo || !ehPastaDoJogo(pastaJogo)) {
    return { valida: false };
  }

  const destino = path.join(pastaJogo, SUBPASTA_PLUGINS, NOME_DLL);
  const hashOrigem = hashArquivo(dllDeOrigem);
  const hashDestino = hashArquivo(destino);

  return {
    valida: true,
    pastaJogo,
    destino,
    instalado: hashDestino !== null,
    atualizado: hashDestino !== null && hashDestino === hashOrigem,
  };
}

function instalarPlugin(pastaJogo, dllDeOrigem) {
  if (!ehPastaDoJogo(pastaJogo)) {
    return {
      ok: false,
      mensagem:
        "Essa pasta não parece ser a do Euro Truck Simulator 2 " +
        "(não encontrei bin\\win_x64\\eurotrucks2.exe).",
    };
  }

  if (!fs.existsSync(dllDeOrigem)) {
    return { ok: false, mensagem: `PluginETS2.dll não encontrado em ${dllDeOrigem}` };
  }

  const pastaPlugins = path.join(pastaJogo, SUBPASTA_PLUGINS);
  const destino = path.join(pastaPlugins, NOME_DLL);

  try {
    fs.mkdirSync(pastaPlugins, { recursive: true });

    // Guarda a DLL anterior antes de sobrescrever.
    let backup = null;
    if (fs.existsSync(destino)) {
      if (hashArquivo(destino) === hashArquivo(dllDeOrigem)) {
        return {
          ok: true,
          jaAtualizado: true,
          destino,
          mensagem: "O plugin já está instalado e atualizado.",
        };
      }
      backup = `${destino}.bak`;
      fs.copyFileSync(destino, backup);
    }

    fs.copyFileSync(dllDeOrigem, destino);

    return {
      ok: true,
      destino,
      backup,
      mensagem: backup
        ? `Plugin atualizado. A versão anterior virou ${path.basename(backup)}.`
        : "Plugin instalado com sucesso.",
    };
  } catch (e) {
    // EBUSY/EPERM = o jogo está aberto segurando a DLL.
    if (e.code === "EBUSY" || e.code === "EPERM" || e.code === "EACCES") {
      return {
        ok: false,
        mensagem:
          "Não foi possível gravar o arquivo. Feche o Euro Truck Simulator 2 " +
          "e tente de novo.",
      };
    }
    return { ok: false, mensagem: `Falha ao instalar: ${e.message}` };
  }
}

module.exports = {
  detectarPastasETS2,
  ehPastaDoJogo,
  instalarPlugin,
  statusInstalacao,
  SUBPASTA_PLUGINS,
  NOME_DLL,
};

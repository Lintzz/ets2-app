// ETS2_Servidor/plugin-remoto.js
//
// Busca a PluginETS2.dll mais recente na release do repositório do plugin, para
// que o servidor instale sempre a versão atual — e não a que estava embutida no
// dia em que este instalador foi gerado.
//
// A DLL embutida (recursos/PluginETS2.dll) continua sendo o plano B: este é um
// app para jogar, o PC pode estar sem internet, e nesse caso a instalação
// precisa funcionar do mesmo jeito.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "Lintzz/ets2-app";
const NOME_ASSET = "PluginETS2.dll";

// O repositório é um monorepo: as releases do plugin, do servidor e do
// aplicativo convivem nele, separadas pelo prefixo da tag. Por isso NÃO dá para
// usar /releases/latest — esse endpoint devolve a mais recente por DATA,
// ignorando a tag, e traria a release do servidor, que não tem a DLL.
const API_RELEASES = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
const PREFIXO_TAG = "plugin-";

const TIMEOUT_CONSULTA_MS = 6000;
const TIMEOUT_DOWNLOAD_MS = 30000;

// Uma DLL do plugin tem ~16 KB. Estes limites servem só para rejeitar de cara um
// download truncado ou uma página de erro devolvida no lugar do arquivo.
const TAMANHO_MINIMO = 4 * 1024;
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

async function buscarComTimeout(url, ms, extras = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, {
      signal: controle.signal,
      headers: {
        "User-Agent": "ETS2-Servidor",
        Accept: "application/vnd.github+json",
        ...extras.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Confere que o arquivo baixado é mesmo um executável do Windows ("MZ"), e não
// um HTML de erro ou um redirecionamento salvo por engano.
function pareceUmaDll(buffer) {
  return (
    buffer.length >= TAMANHO_MINIMO &&
    buffer.length <= TAMANHO_MAXIMO &&
    buffer[0] === 0x4d &&
    buffer[1] === 0x5a
  );
}

const hashDe = (buffer) => crypto.createHash("md5").update(buffer).digest("hex");

// Consulta a release mais recente do plugin. Devolve null quando não há rede —
// sem barulho, é uma situação esperada.
async function consultarUltimaRelease() {
  try {
    const resposta = await buscarComTimeout(API_RELEASES, TIMEOUT_CONSULTA_MS);
    if (!resposta.ok) return null;

    // A API já devolve da mais nova para a mais velha. Rascunhos e pré-releases
    // ficam de fora: quem instala o plugin é o usuário final.
    const lista = await resposta.json();
    if (!Array.isArray(lista)) return null;

    const release = lista.find(
      (r) =>
        typeof r.tag_name === "string" &&
        r.tag_name.startsWith(PREFIXO_TAG) &&
        !r.draft &&
        !r.prerelease &&
        (r.assets || []).some((a) => a.name === NOME_ASSET)
    );
    if (!release) return null;

    const asset = release.assets.find((a) => a.name === NOME_ASSET);

    return {
      tag: release.tag_name,
      publicadoEm: release.published_at,
      url: asset.browser_download_url,
      tamanho: asset.size,
      pagina: release.html_url,
    };
  } catch {
    return null;
  }
}

// Baixa a DLL da release e guarda em cache no userData. Se já houver um arquivo
// em cache para a mesma tag, reaproveita em vez de baixar de novo.
async function baixarDll(release, pastaCache) {
  const destino = path.join(pastaCache, `PluginETS2-${release.tag}.dll`);

  if (fs.existsSync(destino)) {
    const existente = fs.readFileSync(destino);
    if (pareceUmaDll(existente)) {
      return { ok: true, caminho: destino, doCache: true, hash: hashDe(existente) };
    }
    fs.unlinkSync(destino); // cache corrompido
  }

  try {
    const resposta = await buscarComTimeout(release.url, TIMEOUT_DOWNLOAD_MS, {
      headers: { Accept: "application/octet-stream" },
    });
    if (!resposta.ok) {
      return { ok: false, mensagem: `GitHub respondeu ${resposta.status}` };
    }

    const buffer = Buffer.from(await resposta.arrayBuffer());
    if (!pareceUmaDll(buffer)) {
      return { ok: false, mensagem: "O arquivo baixado não é uma DLL válida." };
    }

    fs.mkdirSync(pastaCache, { recursive: true });
    fs.writeFileSync(destino, buffer);

    return { ok: true, caminho: destino, doCache: false, hash: hashDe(buffer) };
  } catch (e) {
    return { ok: false, mensagem: `Falha no download: ${e.message}` };
  }
}

// Decide qual DLL usar: a da release, quando der para obtê-la; senão a embutida.
// Nunca falha — no pior caso devolve a embutida.
async function melhorDllDisponivel(dllEmbutida, pastaCache) {
  const release = await consultarUltimaRelease();

  if (!release) {
    return {
      caminho: dllEmbutida,
      origem: "embutida",
      motivo: "Sem conexão com o GitHub — usando a DLL que veio com o servidor.",
    };
  }

  const baixada = await baixarDll(release, pastaCache);
  if (!baixada.ok) {
    return {
      caminho: dllEmbutida,
      origem: "embutida",
      release,
      motivo: `${baixada.mensagem} Usando a DLL que veio com o servidor.`,
    };
  }

  return {
    caminho: baixada.caminho,
    origem: "release",
    release,
    doCache: baixada.doCache,
    motivo: `Plugin ${release.tag} obtido do GitHub.`,
  };
}

module.exports = { consultarUltimaRelease, baixarDll, melhorDllDisponivel, REPO };

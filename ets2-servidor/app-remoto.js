// Dashlz servidor/app-remoto.js
//
// Descobre o APK da última release do aplicativo e monta o QR code que a janela
// de status mostra. Quem lê o código com a câmera do tablet cai direto no
// download — sem procurar release no GitHub, sem cabo, sem digitar URL.
//
// O QR carrega o link do GitHub, não um arquivo servido daqui: o APK tem ~75 MB
// e guardá-lo no userData para servir na rede local custaria caro para resolver
// um caso raro (tablet no Wi-Fi de casa sem internet nenhuma).

const QRCode = require("qrcode");

const REPO = "Lintzz/ets2-app";

// Mesmo motivo do plugin-remoto.js: o repositório é um monorepo e
// /releases/latest devolve a mais recente por DATA, ignorando a tag — traria a
// release do servidor, que não tem APK nenhum.
const API_RELEASES = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
const PREFIXO_TAG = "app-";

const TIMEOUT_CONSULTA_MS = 6000;

// Diferente da DLL, que casa pelo nome exato "PluginETS2.dll", o asset do
// aplicativo já foi publicado com nome gerado pelo Expo
// ("2.-.ETS2.Dashboard.1.2.0.apk"). Casar por extensão é o que sobrevive a isso.
const ehApk = (asset) => /\.apk$/i.test(asset.name || "");

// Verde do painel sobre o fundo escuro da janela. Câmera de celular lê bem
// desde que o contraste seja alto; o claro fica branco de propósito, porque
// leitor nenhum gosta de QR com fundo escuro.
const COR_ESCURA = "#0b0f10";
const COR_CLARA = "#ffffff";

async function buscarComTimeout(url, ms) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, {
      signal: controle.signal,
      headers: {
        "User-Agent": "Dashlz",
        Accept: "application/vnd.github+json",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Devolve null quando não há rede. É situação esperada — este é um app para
// jogar, o PC pode estar offline — então não vira erro.
async function consultarUltimaRelease() {
  try {
    const resposta = await buscarComTimeout(API_RELEASES, TIMEOUT_CONSULTA_MS);
    if (!resposta.ok) return null;

    // A API devolve da mais nova para a mais velha. Rascunho e pré-release
    // ficam de fora: quem lê o QR é o usuário final.
    const lista = await resposta.json();
    if (!Array.isArray(lista)) return null;

    const release = lista.find(
      (r) =>
        typeof r.tag_name === "string" &&
        r.tag_name.startsWith(PREFIXO_TAG) &&
        !r.draft &&
        !r.prerelease &&
        (r.assets || []).some(ehApk)
    );
    if (!release) return null;

    const asset = release.assets.find(ehApk);

    return {
      tag: release.tag_name,
      // O prefixo é assunto do repositório, não de quem instala.
      versao: release.tag_name.slice(PREFIXO_TAG.length),
      publicadoEm: release.published_at,
      url: asset.browser_download_url,
      arquivo: asset.name,
      tamanho: asset.size,
      pagina: release.html_url,
    };
  } catch {
    return null;
  }
}

// SVG em vez de PNG: a janela redimensiona e o QR precisa continuar nítido.
// Vai como data URI para o renderer poder usá-lo num <img src> — a janela roda
// com contextIsolation e não injeta markup vindo do processo principal.
async function gerarQr(texto) {
  const svg = await QRCode.toString(texto, {
    type: "svg",
    margin: 1,
    // "M" corrige ~15% do código. Como o QR aqui é lido de um monitor, limpo e
    // sem dobra, não compensa gastar módulos com um nível maior — mais módulos
    // deixam o desenho mais fino e mais difícil para a câmera.
    errorCorrectionLevel: "M",
    color: { dark: COR_ESCURA, light: COR_CLARA },
  });

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Estado completo do painel "Instalar no tablet". Nunca lança: sem rede, devolve
// disponivel:false com o motivo, e o painel mostra o link do repositório.
async function estadoDoApk() {
  const release = await consultarUltimaRelease();

  if (!release) {
    return {
      disponivel: false,
      motivo: "Sem conexão com o GitHub — não deu para achar o APK.",
      pagina: `https://github.com/${REPO}/releases`,
    };
  }

  try {
    return {
      disponivel: true,
      versao: release.versao,
      tamanho: release.tamanho,
      arquivo: release.arquivo,
      url: release.url,
      pagina: release.pagina,
      publicadoEm: release.publicadoEm,
      qr: await gerarQr(release.url),
      motivo: `APK ${release.versao} encontrado no GitHub.`,
    };
  } catch (e) {
    return {
      disponivel: false,
      motivo: `Não foi possível gerar o QR code: ${e.message}`,
      pagina: release.pagina,
    };
  }
}

module.exports = { consultarUltimaRelease, estadoDoApk, gerarQr, REPO };

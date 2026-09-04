// ETS2_DashboardFixo/hooks/descoberta.js
//
// Descoberta do servidor por varredura HTTP da própria sub-rede.
//
// Por que não broadcast UDP (como era antes): o servidor mandava um broadcast e
// o celular precisava recebê-lo. Isso funciona no cabo (tethering USB, onde PC e
// celular ficam num link direto), mas falha no Wi-Fi de casa por dois motivos
// comuns — muitos roteadores/APs não repassam broadcast dirigido do lado cabeado
// para o rádio, e o Android descarta pacotes de broadcast sem um multicast lock.
//
// Aqui a iniciativa é do celular: ele pergunta "você é o servidor?" para cada IP
// da sua própria faixa. Isso é sempre tráfego unicast normal, que qualquer
// roteador entrega, e ainda dispensa módulo nativo de UDP.

import * as Network from "expo-network";
import {
  ASSINATURA_SERVIDOR,
  CONCORRENCIA_VARREDURA,
  ROTA_IDENTIFICACAO,
  TCP_PORT,
  TIMEOUT_IDENTIFICACAO_MS,
} from "./protocolo";

// fetch com timeout — sem isso um IP sem resposta seguraria a varredura até o
// timeout padrão do sistema (dezenas de segundos).
async function buscarComTimeout(url, ms) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { signal: controle.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

// Pergunta a um IP se ele é o servidor do dashboard.
export async function identificar(ip, timeoutMs = TIMEOUT_IDENTIFICACAO_MS, porta = TCP_PORT) {
  try {
    const resposta = await buscarComTimeout(
      `http://${ip}:${porta}${ROTA_IDENTIFICACAO}`,
      timeoutMs
    );
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (dados && dados.t === ASSINATURA_SERVIDOR) {
      return { ip, port: dados.port || porta, nome: dados.nome || ip, versao: dados.v };
    }
  } catch {
    // Sem resposta, recusado, timeout: só não é o servidor.
  }
  return null;
}

// IP local do aparelho, para saber qual faixa varrer.
export async function ipDoAparelho() {
  try {
    const ip = await Network.getIpAddressAsync();
    return ip && ip !== "0.0.0.0" ? ip : null;
  } catch {
    return null;
  }
}

// Varre a sub-rede /24 do aparelho. Devolve o servidor encontrado ou null.
// onProgresso recebe { testados, total } para a tela de conexão.
export async function varrerSubRede({ sinal, onProgresso } = {}) {
  const meuIp = await ipDoAparelho();
  if (!meuIp) return null;

  const prefixo = meuIp.slice(0, meuIp.lastIndexOf(".") + 1);
  const meuUltimoOcteto = Number(meuIp.slice(meuIp.lastIndexOf(".") + 1));

  // Ordem de tentativa: vizinhos do próprio IP primeiro (o PC costuma ter um
  // endereço próximo por DHCP), depois os típicos de servidor, depois o resto.
  const candidatos = [];
  for (let d = 1; d <= 254; d++) {
    if (d !== meuUltimoOcteto) candidatos.push(d);
  }
  candidatos.sort((a, b) => Math.abs(a - meuUltimoOcteto) - Math.abs(b - meuUltimoOcteto));

  const total = candidatos.length;
  let testados = 0;
  let encontrado = null;
  let proximo = 0;

  async function trabalhador() {
    while (proximo < candidatos.length && !encontrado) {
      if (sinal?.cancelado) return;

      const octeto = candidatos[proximo++];
      const resultado = await identificar(`${prefixo}${octeto}`);

      testados += 1;
      onProgresso?.({ testados, total });

      if (resultado && !encontrado) encontrado = resultado;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA_VARREDURA, total) }, trabalhador)
  );

  return encontrado;
}

// Dashlz app/screens/ConexaoScreen.js
// Tela mostrada enquanto não há telemetria. Além do status da busca, oferece a
// entrada manual do IP — a saída garantida para qualquer rede que a varredura
// automática não cubra (sub-rede diferente, /16, Wi-Fi com isolamento de
// clientes, firewall bloqueando a varredura).

import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import styles from "../styles/dashboardStyles";
import { CODIGO_DIGITOS, RECUSA, TCP_PORT } from "../hooks/protocolo";

const MENSAGENS = {
  iniciando: "Iniciando...",
  procurando: "Procurando o servidor na rede...",
  conectando: "Conectando ao servidor...",
  conectado: "Conectado. Aguardando o jogo...",
  "sem-servidor": "Servidor não encontrado nesta rede.",
  "precisa-codigo": "Parear com o PC",
  recusado: "Recusado: já existe outro aparelho pareado.",
  "app-desatualizado": "Este aplicativo está desatualizado.",
};

// Explicação de cada motivo de recusa mandado pelo servidor.
const MOTIVOS = {
  [RECUSA.PRECISA_CODIGO]:
    "Digite o código de 6 dígitos que aparece na janela do servidor, no PC.",
  [RECUSA.CODIGO_INVALIDO]:
    "Código errado ou vencido. Gere um novo na janela do servidor e tente de novo.",
  [RECUSA.PROVA_INVALIDA]:
    "O pareamento anterior não vale mais. Digite o código mostrado no PC.",
  [RECUSA.JA_PAREADO]:
    'Outro aparelho já está pareado. No PC, clique em "Esquecer aparelho" para trocar.',
  [RECUSA.PROTOCOLO]:
    "O servidor no PC é mais novo que este aplicativo. Instale a versão nova do app.",
};

const IP_VALIDO = /^(\d{1,3}\.){3}\d{1,3}$/;

export default function ConexaoScreen({
  estado,
  servidor,
  progresso,
  erroPareamento,
  conectarManual,
  procurarNovamente,
  parearComCodigo,
}) {
  const [ip, setIp] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState(null);
  const [tentando, setTentando] = useState(false);

  const ocupado = estado === "procurando" || estado === "conectando" || tentando;
  const pedindoCodigo = estado === "precisa-codigo";

  const enviarCodigo = () => {
    if (!parearComCodigo(codigo)) {
      setErro(`O código tem ${CODIGO_DIGITOS} dígitos.`);
      return;
    }
    setErro(null);
    setCodigo("");
  };

  const tentarManual = async () => {
    const alvo = ip.trim();
    if (!IP_VALIDO.test(alvo)) {
      setErro("Digite um IP no formato 192.168.0.10");
      return;
    }
    setErro(null);
    setTentando(true);
    const ok = await conectarManual(alvo, TCP_PORT);
    setTentando(false);
    if (!ok) setErro(`Nenhum servidor respondeu em ${alvo}:${TCP_PORT}`);
  };

  return (
    <View style={styles.statusContainer}>
      <StatusBar hidden />

      {ocupado && <ActivityIndicator size="large" color="#FFA500" />}

      <Text style={styles.statusText}>{MENSAGENS[estado] || estado}</Text>

      {progresso && (
        <Text style={styles.conexaoSubtexto}>
          {progresso.testados} de {progresso.total} endereços verificados
        </Text>
      )}

      {estado === "conectado" && servidor && (
        <Text style={styles.conexaoSubtexto}>
          {servidor.nome} ({servidor.ip})
        </Text>
      )}

      {erroPareamento && MOTIVOS[erroPareamento] && (
        <Text style={styles.conexaoSubtexto}>{MOTIVOS[erroPareamento]}</Text>
      )}

      {pedindoCodigo && !erroPareamento && (
        <Text style={styles.conexaoSubtexto}>{MOTIVOS[RECUSA.PRECISA_CODIGO]}</Text>
      )}

      {pedindoCodigo && (
        <View style={styles.conexaoManual}>
          <View style={styles.conexaoLinha}>
            <TextInput
              style={[styles.conexaoInput, styles.codigoInput]}
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, "").slice(0, CODIGO_DIGITOS))}
              placeholder="000000"
              placeholderTextColor="#8A8A8E"
              keyboardType="number-pad"
              maxLength={CODIGO_DIGITOS}
              autoFocus
              autoCorrect={false}
            />
            <Pressable
              style={[
                styles.conexaoBotao,
                codigo.length !== CODIGO_DIGITOS && styles.conexaoBotaoInativo,
              ]}
              onPress={enviarCodigo}
              disabled={codigo.length !== CODIGO_DIGITOS}
            >
              <Text style={styles.conexaoBotaoTexto}>Parear</Text>
            </Pressable>
          </View>

          {erro && <Text style={styles.conexaoErro}>{erro}</Text>}
        </View>
      )}

      {(estado === "sem-servidor" || estado === "recusado") && (
        <View style={styles.conexaoManual}>
          <Text style={styles.conexaoSubtexto}>
            Confira o IP mostrado na janela do servidor e digite abaixo:
          </Text>

          <View style={styles.conexaoLinha}>
            <TextInput
              style={styles.conexaoInput}
              value={ip}
              onChangeText={setIp}
              placeholder="192.168.0.10"
              placeholderTextColor="#8A8A8E"
              keyboardType="numeric"
              autoCorrect={false}
              editable={!tentando}
            />
            <Pressable
              style={[styles.conexaoBotao, tentando && styles.conexaoBotaoInativo]}
              onPress={tentarManual}
              disabled={tentando}
            >
              <Text style={styles.conexaoBotaoTexto}>Conectar</Text>
            </Pressable>
          </View>

          {erro && <Text style={styles.conexaoErro}>{erro}</Text>}

          <Pressable
            style={[styles.conexaoBotaoSecundario, ocupado && styles.conexaoBotaoInativo]}
            onPress={procurarNovamente}
            disabled={ocupado}
          >
            <Text style={styles.conexaoBotaoTexto}>Procurar de novo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ETS2_DashboardFixo/screens/ConexaoScreen.js
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
import { TCP_PORT } from "../hooks/protocolo";

const MENSAGENS = {
  iniciando: "Iniciando...",
  procurando: "Procurando o servidor na rede...",
  conectando: "Conectando ao servidor...",
  conectado: "Conectado. Aguardando o jogo...",
  "sem-servidor": "Servidor não encontrado nesta rede.",
  recusado: "Recusado: já existe outro aparelho pareado.",
};

const IP_VALIDO = /^(\d{1,3}\.){3}\d{1,3}$/;

export default function ConexaoScreen({
  estado,
  servidor,
  progresso,
  conectarManual,
  procurarNovamente,
}) {
  const [ip, setIp] = useState("");
  const [erro, setErro] = useState(null);
  const [tentando, setTentando] = useState(false);

  const ocupado = estado === "procurando" || estado === "conectando" || tentando;

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

      {estado === "recusado" && (
        <Text style={styles.conexaoSubtexto}>
          Na janela do servidor no PC, clique em "Esquecer aparelho" para parear
          este aqui.
        </Text>
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

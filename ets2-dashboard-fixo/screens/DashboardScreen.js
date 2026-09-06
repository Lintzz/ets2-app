import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import ConexaoScreen from "./ConexaoScreen";
import DashboardWidget from "../components/DashboardWidget";
import { CHAVE_LAYOUT } from "../hooks/protocolo";
import { useTelemetry } from "../hooks/useTelemetry";
import styles from "../styles/dashboardStyles";
import { WIDGET_LIBRARY } from "../WidgetLibrary";
import { TAMANHO_CELULA as GRID_CELL_SIZE } from "../../compartilhado/constantes";
// O painel de fábrica mora em compartilhado/ porque a janela de espelho do
// servidor desenha o mesmo layout. rehydrateLayout continua sendo o único lugar
// que junta "o que o widget é" (catálogo) com "onde ele fica" (layout).
import layoutPadrao from "../../compartilhado/layout-padrao.json";

// // =================== COMPONENTE PARA VISUALIZAR A GRADE ===================
// const GridOverlay = () => {
//   const horizontalLines = [];
//   const verticalLines = [];

//   // Ajuste o número de linhas para se adequar à sua tela
//   const numberOfCellsX = 40; // Exemplo: 40 células na horizontal
//   const numberOfCellsY = 25; // Exemplo: 25 células na vertical

//   for (let i = 0; i < numberOfCellsY; i++) {
//     horizontalLines.push(
//       <View
//         key={`h-${i}`}
//         style={{
//           position: "absolute",
//           top: i * GRID_CELL_SIZE,
//           left: 0,
//           right: 0,
//           height: 1,
//           backgroundColor: "rgba(255, 0, 0, 0.5)", // Cor vermelha semitransparente
//         }}
//       />
//     );
//   }

//   for (let i = 0; i < numberOfCellsX; i++) {
//     verticalLines.push(
//       <View
//         key={`v-${i}`}
//         style={{
//           position: "absolute",
//           top: 0,
//           bottom: 0,
//           left: i * GRID_CELL_SIZE,
//           width: 1,
//           backgroundColor: "rgba(255, 0, 0, 0.5)", // Cor vermelha semitransparente
//         }}
//       />
//     );
//   }

//   return (
//     <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
//       {horizontalLines}
//       {verticalLines}
//     </View>
//   );
// };
// // ===========================================================================


const rehydrateLayout = (layout) => {
  return layout
    .map((savedWidget) => {
      const libraryConfig = WIDGET_LIBRARY[savedWidget.widgetKey];
      if (!libraryConfig) return null;
      return {
        ...libraryConfig,
        ...savedWidget,
        options: { ...libraryConfig.options, ...savedWidget.options },
      };
    })
    .filter(Boolean);
};

export default function DashboardScreen() {
  const [widgets, setWidgets] = useState([]);
  // Moldura da tela, em células, quando o layout traz uma. O de fábrica não traz.
  const [tela, setTela] = useState(null);
  const {
    estado,
    telemetry,
    layout,
    servidor,
    progresso,
    erroPareamento,
    pressKey,
    holdKeyDown,
    holdKeyUp,
    conectarManual,
    procurarNovamente,
    parearComCodigo,
  } = useTelemetry();

  // Na abertura: o layout que o PC mandou da última vez, guardado no aparelho. O
  // de fábrica é o chão — é ele que faz o painel abrir sem servidor e sem rede.
  useEffect(() => {
    let cancelado = false;

    // O de fábrica entra já, para a tela nunca ficar vazia enquanto o disco
    // responde. Se houver um guardado, ele substitui logo em seguida.
    setWidgets(rehydrateLayout(layoutPadrao));

    AsyncStorage.getItem(CHAVE_LAYOUT)
      .then((bruto) => {
        if (cancelado || !bruto) return;
        const guardado = JSON.parse(bruto);
        // Array puro é o formato da versão anterior, de antes da moldura existir.
        const itens = Array.isArray(guardado) ? guardado : guardado.widgets;
        if (Array.isArray(itens) && itens.length) {
          setWidgets(rehydrateLayout(itens));
          setTela(Array.isArray(guardado) ? null : guardado.tela || null);
        }
      })
      .catch(() => {
        /* sem storage, ou JSON estragado: fica o de fábrica */
      });

    return () => {
      cancelado = true;
    };
  }, []);

  // E, a partir daí, o que chegar do PC manda — inclusive troca de preset com o
  // painel já na tela.
  useEffect(() => {
    if (!layout || !layout.widgets || !layout.widgets.length) return;
    setWidgets(rehydrateLayout(layout.widgets));
    setTela(layout.tela || null);
  }, [layout]);

  // O grid é desenhado a partir de (0,0): "left: x * GRID_CELL_SIZE" e mais
  // nada. Como a primeira coluna e a primeira linha ocupadas são a 1, sobrava
  // uma folga fixa de uma célula à esquerda e no topo, e todo o resto da tela
  // caía à direita e embaixo — os lados ficavam visivelmente desiguais. Aqui os
  // limites reais do layout são medidos e o bloco inteiro é deslocado para
  // centralizar. Nenhum widget muda de tamanho; só a posição do conjunto.
  // Com uma moldura declarada, ela é o retângulo a centralizar — foi assim que o
  // painel foi desenhado no editor, e é o que faz o resultado no tablet bater com
  // o que se viu no PC. Sem ela vale a medição, como sempre.
  const limites = useMemo(() => {
    if (tela) {
      return {
        minX: 0,
        minY: 0,
        largura: tela.colunas * GRID_CELL_SIZE,
        altura: tela.linhas * GRID_CELL_SIZE,
      };
    }
    if (!widgets.length) return null;
    const minX = Math.min(...widgets.map((w) => w.x));
    const minY = Math.min(...widgets.map((w) => w.y));
    const maxX = Math.max(...widgets.map((w) => w.x + w.w));
    const maxY = Math.max(...widgets.map((w) => w.y + w.h));
    return {
      minX,
      minY,
      largura: (maxX - minX) * GRID_CELL_SIZE,
      altura: (maxY - minY) * GRID_CELL_SIZE,
    };
  }, [widgets, tela]);

  // useWindowDimensions em vez de Dimensions.get: reage a rotação e a mudanças
  // de tamanho da janela sem precisar de listener.
  const { width: larguraTela, height: alturaTela } = useWindowDimensions();
  const deslocamento = useMemo(() => {
    if (!limites) return { x: 0, y: 0 };
    // O Math.max(0, ...) é a guarda para uma tela menor que o grid: em vez de
    // cortar dos dois lados, o conteúdo encosta na borda como antes.
    return {
      x:
        Math.max(0, (larguraTela - limites.largura) / 2) -
        limites.minX * GRID_CELL_SIZE,
      y:
        Math.max(0, (alturaTela - limites.altura) / 2) -
        limites.minY * GRID_CELL_SIZE,
    };
  }, [limites, larguraTela, alturaTela]);

  // telemetry vem null com o jogo fechado ou sem servidor — aí não há painel a
  // mostrar. Já { jogoRodando:false, inMenu:true } é o jogo no menu ou pausado:
  // antes isso também caía na ConexaoScreen, e o painel sumia justo quando o
  // botão de ESC era o que faltava para voltar ao jogo. Agora o painel fica na
  // tela, com os botões vivos e os mostradores em "--".
  if (!telemetry) {
    return (
      <ConexaoScreen
        estado={estado}
        servidor={servidor}
        progresso={progresso}
        erroPareamento={erroPareamento}
        conectarManual={conectarManual}
        procurarNovamente={procurarNovamente}
        parearComCodigo={parearComCodigo}
      />
    );
  }

  const aoVivo = telemetry.jogoRodando !== false;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View
        style={[
          styles.gridContainer,
          {
            transform: [
              { translateX: deslocamento.x },
              { translateY: deslocamento.y },
            ],
          },
        ]}
      >
        {widgets.map((widget, index) => (
          <View
            key={widget.id}
            style={[
              styles.widgetWrapper,
              {
                left: widget.x * GRID_CELL_SIZE,
                top: widget.y * GRID_CELL_SIZE,
                width: widget.w * GRID_CELL_SIZE,
                height: widget.h * GRID_CELL_SIZE,
                zIndex: index,
              },
            ]}
          >
            <DashboardWidget
              config={widget}
              telemetry={telemetry}
              pressKey={pressKey}
              holdKeyDown={holdKeyDown}
              holdKeyUp={holdKeyUp}
              aoVivo={aoVivo}
            />
          </View>
        ))}
        {/* Adicione o componente de grade aqui
        <GridOverlay /> */}
      </View>

      {!aoVivo && (
        <View style={styles.avisoMenu} pointerEvents="none">
          <Text style={styles.avisoMenuTexto}>
            JOGO NO MENU · botões ativos, dados pausados
          </Text>
        </View>
      )}
    </View>
  );
}

# compartilhado/

Contrato de widgets lido pelo **app** (`ets2-dashboard-fixo`) e pela **janela de
espelho do servidor** (`ets2-servidor/dashboard.html`). Existe pelo mesmo motivo
do monorepo: mexer no painel é uma mudança que atravessa as duas pastas, e um
catálogo duplicado divergiria como o `struct TelemetriaCompleta` quase diverge.

| Arquivo | O que é |
|---|---|
| `catalogo-widgets.json` | os 77 widgets — *o que cada widget é* |
| `layout-padrao.json` | os 88 itens do painel de fábrica — *onde cada um fica* |
| `avaliador.js` | interpreta `ativoSe` e `valor` (CommonJS, os dois lados usam) |
| `cores.js` | a paleta e os padrões de `options.cores` |
| `validar-layout.js` | valida um layout antes de ele virar tela |
| `constantes.js` | `TAMANHO_CELULA` — a unidade de x/y/w/h |

## Por que é JSON e não JavaScript

Até a versão anterior o catálogo vivia em `WidgetLibrary.js` e carregava funções:

```js
isActiveCheck: (t) => t.freioEstacionamento,
value: (t) => `${((t.danoMotor ?? 0) * 100).toFixed(0)}%`,
```

Função não vira JSON. Enquanto fossem funções, o catálogo não podia sair do
bundle do app — nem para a janela do servidor, nem para um layout salvo em disco
ou mandado para o tablet. Viraram descritores:

```jsonc
"ativoSe": { "campo": "freioEstacionamento" }
"valor":   { "campo": "danoMotor", "escala": 100, "casas": 0, "sufixo": "%" }
```

## Gramática

**`ativoSe`** — estado aceso/apagado de um botão ou alerta:

```jsonc
{ "campo": "freioEstacionamento" }                       // truthy
{ "campo": "velocidadeCruzeiroKmh", "op": ">", "valor": 0 }
{ "qualquer": [ { "campo": "farolBaixo" }, { "campo": "farolAlto" } ] }
{ "todos":    [ { "campo": "motorLigado" }, { "campo": "reboqueConectado" } ] }
```

`op` aceita `> >= < <= == !=`. Sem descritor, o widget nunca acende.

**`valor`** — texto de um `DataDisplay`:

```jsonc
{ "campo": "velocidadeKmh", "casas": 0 }
{ "campo": "navDistancia", "divisor": 1000, "casas": 1, "sufixo": " km" }
{ "campo": "danoMotor", "escala": 100, "casas": 0, "sufixo": "%" }
{ "campo": "retarder" }                                  // cru
{ "campo": "marcha", "formato": "marcha" }               // formatador nomeado
```

Sem descritor o mostrador fica em `--`. `formato` é a saída de emergência para o
que não cabe em escala/casas/sufixo; hoje só existe `marcha`, e acrescentar um
novo é editar `FORMATOS` em `avaliador.js`.

**`cores`** é um objeto parcial; o que não for declarado cai no padrão de
`cores.js`. Era o que faltava para conseguir pintar um botão — antes só
`ColorArea`, `TextWidget` e os alertas tinham cor, e o verde dos botões estava
cravado no código dos dois renderizadores.

```jsonc
"options": { "cores": { "iconeAtiva": "#FFD700", "bordaAtiva": "#FFD700" } }
```

As chaves são `icone`/`iconeAtiva`, `fundo`/`fundoAtiva`, `borda`/`bordaAtiva`,
`rotulo`, `valor`, `alerta`/`alertaApagado`. Só hexadecimal e `rgb()`/`rgba()`
passam pelo validador: a cor vai parar dentro de `style` nos dois lados.

**`iconName`** é sempre string: nome do MaterialCommunityIcons (`"car-brake-parking"`)
ou `"svg:Nome"` para os desenhos próprios. Cada lado resolve o prefixo no seu meio —
o app pega o componente em `SvgLibrary.js`, o servidor pega o desenho em
`ets2-servidor/dashboard/icones.json`.

`campo` tem que ser um campo real da telemetria, ou seja, algo que
`ets2-servidor/leitor_memoria.cpp` publica em `LerDados`.

## Layouts

`layout-padrao.json` é o painel de fábrica e o chão de tudo: é ele que faz o tablet
abrir sem servidor e sem rede. Os layouts que o usuário cria ficam em
`userData/layouts.json` no PC (`ets2-servidor/layouts.js`) — nunca aqui, que é
somente-leitura quando empacotado.

Um layout pode declarar `tela: { colunas, linhas }`, em celulas: e a moldura da
tela do tablet, que o editor desenha e usa para avisar quando um widget cai fora.
Sem ela vale o comportamento antigo — o app mede os limites do que existe e
centraliza o bloco. `layout-padrao.json` continua sendo um array puro, sem
moldura, porque mudar a forma do arquivo quebraria o fallback embutido do app.
Widget fora da moldura e **avisado, nunca descartado**: quem decide o que cabe na
tela e o dono do painel.

O layout ativo viaja do PC para o tablet pelo WebSocket já pareado, logo depois do
`welcome`. O app guarda em `AsyncStorage` (`ets2:layout`) e o usa; a ordem é
**recebido agora → guardado → de fábrica**.

`validar-layout.js` roda nos dois lados — no servidor ao gravar, no app ao receber.
Item ruim é descartado, não derruba o painel: um widget a menos é recuperável, uma
tela preta no meio de uma viagem não.

**O servidor só manda `layout` para quem declara `recursos: ["layout"]` no `hello`.**
Isso não é detalhe: o `onmessage` do app trata como telemetria tudo que não
reconhece, então um APK antigo receberia o layout e encheria os mostradores de lixo.
Como o servidor se atualiza sozinho e o APK não, esse par existe de verdade.

## Ao acrescentar um widget

1. entrada em `catalogo-widgets.json`;
2. se ele aperta tecla, a tecla precisa entrar em `TECLAS_PERMITIDAS`
   (`ets2-servidor/protocolo.js`) — fora da allowlist o servidor recusa;
3. se o ícone é novo, rode `npm run gerar:icones` em `ets2-servidor`;
4. posição em `layout-padrao.json`.

## Como os dois lados chegam aqui

- **App**: `metro.config.js` tem esta pasta em `watchFolders`.
- **Servidor**: `preload.js` carrega os arquivos direto. Empacotado a pasta vem por
  `extraResource`, então fica em `process.resourcesPath/compartilhado` em vez de
  `../compartilhado` — o mesmo desvio que `recursos/PluginETS2.dll` já faz.

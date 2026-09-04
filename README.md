# :truck: Dashlz

<p align="center">
  <img src="https://img.shields.io/badge/C%2B%2B-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="WebSocket" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/licença-MIT-green?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/badge/plataforma-Windows%20%2B%20Android-blue?style=flat-square" alt="Windows + Android" />
</p>

> Transforma um tablet no painel do seu caminhão: telemetria do Euro Truck
> Simulator 2 a 20 Hz pelo Wi-Fi, com botões que acionam os comandos do jogo de
> volta no PC.

---

## :clipboard: Tabela de Conteúdos

- [Como funciona](#-como-funciona)
- [Instalação](#-instalação)
- [Parear o tablet](#-parear-o-tablet)
- [Se não conectar](#-se-não-conectar)
- [Segurança](#-segurança)
- [Este repositório](#-este-repositório)
- [Desenvolvimento](#-desenvolvimento)
- [Licença](#-licença)
- [Contato](#-contato)

---

## :arrows_counterclockwise: Como funciona

São três peças, e cada uma vive numa pasta deste repositório:

```
Euro Truck Simulator 2
  └─ PluginETS2.dll ........................... ets2-plugin/
       lê ~55 canais de telemetria pelo SCS SDK e escreve
       numa região de memória compartilhada do Windows
       ↓
  Dashlz servidor (Electron, na bandeja) ....... ets2-servidor/
       lê essa memória 20x por segundo, serve um WebSocket
       na porta 3000 e devolve os comandos ao teclado do jogo
       ↓  Wi-Fi
  Dashlz app (Android) ......................... ets2-dashboard-fixo/
       acha o servidor sozinho na rede, desenha o painel
       e manda de volta o que você aperta
```

Nada sai do seu PC. A telemetria vai direto para o tablet, dentro da sua rede.
O único acesso à internet é para procurar versão nova do plugin e do servidor.

**Site oficial:** [ets2-landing-page.vercel.app](https://ets2-landing-page.vercel.app/)

---

## :inbox_tray: Instalação

Baixe os arquivos na [página de releases](https://github.com/Lintzz/ets2-app/releases)
e siga nesta ordem.

### 1. O servidor, no PC

Baixe o `Setup.exe` da release **`vX.Y.Z`** (sem prefixo — essa é a do servidor) e
execute. Ele abre sozinho no fim da instalação e fica na bandeja, ao lado do
relógio, com o ícone do mostrador.

> O instalador não tem assinatura digital paga, então o SmartScreen vai avisar.
> Clique em **Mais informações** → **Executar assim mesmo**.

### 2. O plugin, no jogo

Não precisa copiar arquivo na mão:

1. abra a janela do servidor (clique no ícone da bandeja);
2. no painel **Plugin no jogo**, ele já detecta a pasta do ETS2 — se não
   detectar, use **Escolher pasta**;
3. clique em **Instalar plugin**;
4. feche e abra o jogo.

O ETS2 precisa estar **fechado** na hora de instalar, senão o arquivo fica
travado (o app avisa quando isso acontece). A DLL vem sempre da última release
`plugin-vX.Y.Z`, então o plugin se mantém em dia sem reinstalar o servidor. Sem
internet, ele usa a cópia que veio junto — a instalação nunca fica bloqueada.

### 3. O aplicativo, no tablet

Na janela do servidor, o painel **Instalar no tablet** mostra um QR code: aponte
a câmera do tablet para ele e o download do `.apk` começa no navegador do
aparelho. O Android vai pedir permissão para "instalar app desconhecido" — é o
normal para instalação fora da Play Store.

Se preferir, baixe o `.apk` da release **`app-vX.Y.Z`** direto da
[página de releases](https://github.com/Lintzz/ets2-app/releases) e copie para o
aparelho.

> **Servidor e aplicativo precisam ser da mesma geração.** O protocolo de
> pareamento mudou na versão 3; versões antigas são recusadas de propósito, com
> uma mensagem explicando.

---

## :key: Parear o tablet

Só na primeira vez. PC e tablet precisam estar na **mesma rede** — o Wi-Fi de
casa serve, e não é preciso cabo USB nem compartilhamento de internet.

1. Na janela do servidor aparece um painel verde **Código de pareamento**, com
   6 dígitos.
2. Abra o app no tablet. Ele procura o servidor sozinho (alguns segundos na
   primeira vez) e então pede o código.
3. Digite os 6 dígitos e toque em **Parear**.

Pronto. Nas próximas vezes ele conecta sozinho, sem pedir código.

- O código vale **10 minutos** e serve **uma vez só**. Se vencer, clique em
  **Gerar outro código**.
- Para trocar de aparelho, clique em **Esquecer aparelho**: o servidor volta a
  mostrar um código novo.

### No dia a dia

Abra o jogo, abra o app. Se você apertar `ESC` e cair no menu, o painel
**continua na tela**: os botões seguem funcionando — é assim que você volta ao
jogo pelo próprio painel — e os mostradores ficam em `--` até a viagem voltar.

---

## :warning: Se não conectar

**Confira o tipo da sua rede no Windows.** O servidor só abre a porta em redes
**Particular** e **Domínio** — de propósito, para não ficar exposto no Wi-Fi de
hotel, aeroporto ou cafeteria. Em *Configurações → Rede e Internet → Wi-Fi (ou
Ethernet)*, mude o perfil para **Rede particular**. É a configuração correta para
a rede de casa, e é a causa mais comum de "não conecta".

Outras saídas:

- na primeira execução o servidor tenta liberar as portas **3000/TCP** e
  **48888/UDP** no Firewall do Windows; se pedir permissão, aceite;
- se a busca automática não achar o servidor, a própria tela do app deixa
  **digitar o IP** do PC — ele aparece na janela do servidor, em "IP do servidor";
- no painel **Log de eventos**, o botão **Abrir arquivo** abre a pasta com o
  registro do que aconteceu, inclusive das sessões anteriores. É esse arquivo
  que ajuda a descobrir o problema.

---

## :lock: Segurança

O servidor digita teclas no seu PC a pedido da rede, então vale ser explícito
sobre o que ele faz e o que não faz.

**O que protege:**

- **Pareamento por código.** Só entra quem digitar os 6 dígitos mostrados na sua
  tela. No pareamento o servidor sorteia um segredo de 32 bytes e o entrega uma
  única vez; depois disso ele nunca mais trafega — a cada conexão o servidor
  manda um *nonce* e o app responde com um hash derivado, que não serve para a
  conexão seguinte. Quem farejar a rede não consegue se passar pelo tablet.
- **Só um aparelho por vez.** Os demais são recusados até você clicar em
  "Esquecer aparelho".
- **Conexões de navegador são barradas.** Sem isso, uma página web qualquer
  poderia varrer a rede local, achar o servidor e mandar comandos.
- **Lista fechada de teclas.** O servidor só aceita as teclas que os widgets
  usam; não há como digitar texto arbitrário no PC.
- **Limite de 25 comandos por segundo** por conexão.
- **Firewall restrito** a redes Particular/Domínio.

**O que não protege:**

- O tráfego é **`ws://` em claro**, sem criptografia. É adequado para a rede de
  casa, não para uma rede pública.
- O instalador do Windows e o APK **não têm assinatura digital**. O SmartScreen
  vai avisar, e o APK usa a chave de desenvolvimento do Expo — serve para
  instalar no seu aparelho, não para publicar na Play Store.

---

## :file_folder: Este repositório

| Pasta | O que é | README |
|---|---|---|
| [`ets2-plugin/`](./ets2-plugin) | DLL em C++ carregada pelo jogo (SCS SDK 1.14) | [ler](./ets2-plugin/README.md) |
| [`ets2-servidor/`](./ets2-servidor) | App Electron no PC: lê a memória e serve o WebSocket | [ler](./ets2-servidor/README.md) |
| [`ets2-dashboard-fixo/`](./ets2-dashboard-fixo) | App Expo / React Native do tablet | [ler](./ets2-dashboard-fixo/README.md) |

As três partes eram repositórios separados. Foram reunidas porque **toda**
mudança do histórico atravessava duas ou três delas: a struct da memória
compartilhada é duplicada entre o plugin e o servidor, o `protocolo.js` é
duplicado entre o servidor e o app, e adicionar um campo de telemetria toca nos
três. Agora isso é um commit só.

### Releases

Como as três convivem aqui, o prefixo da tag diz de quem é cada uma:

| Tag | Componente | Artefato |
|---|---|---|
| `vX.Y.Z` | servidor | `Setup.exe`, `RELEASES`, `.nupkg` |
| `plugin-vX.Y.Z` | plugin | `PluginETS2.dll` |
| `app-vX.Y.Z` | aplicativo | `.apk` |

O servidor fica sem prefixo porque o serviço de atualização automática lê a tag
como número de versão.

---

## :computer: Desenvolvimento

Cada pasta tem o seu próprio README com pré-requisitos e passos completos. Em
resumo:

```bash
git clone https://github.com/Lintzz/ets2-app.git
cd ets2-app

# Servidor (precisa do Visual Studio Build Tools, workload C++)
cd ets2-servidor && npm install && npm start
npm test        # testes do pareamento e das travas de conexão
npm run make    # gera o instalador em out/make/

# Aplicativo (não funciona no Expo Go — usa módulos nativos)
cd ets2-dashboard-fixo && npm install && npx expo start --dev-client
```

O plugin é compilado pelo Visual Studio 2022, em **x64** — é o que o ETS2 carrega.

Comentários, mensagens de commit e identificadores estão em português. Vale
manter.

---

## :page_facing_up: Licença

Este projeto está sob a licença [MIT](./LICENSE).

---

## :mailbox_with_mail: Contato

Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)

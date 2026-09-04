# :rocket: ETS2 Servidor Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/C%2B%2B-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="WebSocket" />
</p>

> Servidor local robusto construído com Electron e C++ para extração e transmissão de telemetria do Euro Truck Simulator 2 para dashboards remotos.

## :clipboard: Tabela de Conteúdos
- [Sobre](#-sobre)
- [Features](#-features)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Como Rodar](#-como-rodar)
- [Licença](#-licença)
- [Contato](#-contato)

---

## :book: Sobre
O **ETS2 Servidor Dashboard** atua como uma ponte de comunicação entre o Euro Truck Simulator 2 e dispositivos externos (como tablets ou celulares) usados como painéis de controle (dashboards). 

Ele utiliza um addon nativo em C++ para ler dados da memória do jogo em alta performance e os transmite em tempo real via WebSocket. O projeto foi desenhado para facilitar a vida do usuário, contando com um sistema de autodescoberta (UDP) para que o cliente se conecte sem precisar digitar IPs manualmente, além de permitir o envio de comandos remotos para o computador, simulando toques no teclado através da biblioteca RobotJS.

---

## :sparkles: Features
- [x] **Leitura Nativa de Memória:** Extração direta de telemetria do ETS2 em tempo real via C++ (node-addon-api).
- [x] **Transmissão WebSocket:** Envio contínuo e rápido dos dados do jogo para clientes conectados.
- [x] **Autodescoberta de Rede:** o app varre a própria sub-rede e identifica o servidor pelo endpoint `GET /ets2`; funciona por Wi-Fi comum, sem depender de broadcast. (O responder UDP na porta 48888 continua ativo por compatibilidade.)
- [x] **Controle Remoto de Teclas:** comandos remotos via RobotJS, restritos a uma allowlist de teclas — nenhum cliente consegue digitar texto arbitrário no PC.
- [x] **Pareamento de Aparelho:** o primeiro tablet que conecta é memorizado; os demais são recusados até você clicar em "Esquecer aparelho".
- [x] **Firewall Automático:** cria as regras de entrada para TCP 3000 e UDP 48888 em todos os perfis de rede (o motivo mais comum de funcionar no cabo e não no Wi-Fi).
- [x] **Instalação do Plugin pelo App:** detecta a pasta do ETS2 automaticamente (lê as bibliotecas do Steam), cria a pasta `plugins` e instala a DLL — com backup da versão anterior. A DLL vem da **última release de [ets2-plugin](https://github.com/Lintzz/ets2-plugin/releases)**, então o plugin fica sempre em dia sem precisar reinstalar o servidor; sem internet, usa a cópia que acompanha o instalador.
- [x] **Interface Oculta e Tray:** Aplicação Electron com janela customizada e suporte a modo silencioso no System Tray.

---

## :globe_with_meridians: Site Oficial & Como Funciona
Acesse o nosso site oficial para mais informações, downloads e guias rápidos: 
**[https://ets2-landing-page.vercel.app/](https://ets2-landing-page.vercel.app/)**

### 🔄 Como o ecossistema funciona?
O projeto é composto por 3 partes principais que trabalham em conjunto para trazer a telemetria do jogo para suas mãos:
1. **[Plugin (C++)](https://github.com/Lintzz/ets2-plugin)**: Roda diretamente dentro do Euro Truck Simulator 2, lendo os dados de telemetria em tempo real e os disponibiliza na memória do PC (Shared Memory).
2. **[Servidor (Node.js/Electron)](https://github.com/Lintzz/ets2-servidor)**: Roda no seu PC, lendo os dados disponibilizados pelo Plugin na memória. Ele cria um servidor WebSocket local e os transmite para a rede.
3. **[Dashboard (App Mobile/Web)](https://github.com/Lintzz/ets2-dashboard-fixo)**: O seu dispositivo (celular/tablet) se conecta ao Servidor através do Wi-Fi (via WebSocket) para exibir todas as informações (velocidade, RPM, combustível, etc.) e pode enviar comandos de volta para o jogo.

---

## :computer: Tecnologias Utilizadas
As principais ferramentas, linguagens e bibliotecas usadas na construção do projeto:
- [Node.js](https://nodejs.org/en/) - Ambiente de execução backend.
- [Electron](https://www.electronjs.org/) - Criação da interface desktop e controle do processo principal.
- [C++ (node-addon-api)](https://github.com/nodejs/node-addon-api) - Addon nativo para acesso à memória em baixo nível.
- [WebSocket (ws)](https://github.com/websockets/ws) - Comunicação bidirecional e em tempo real.
- [RobotJS](https://robotjs.io/) - Automação e simulação de toques no teclado do sistema operacional.

---

## :rocket: Como Rodar

### Pré-requisitos
Antes de começar, você vai precisar ter instalado na sua máquina o [Node.js](https://nodejs.org/en/) e o [Git](https://git-scm.com/). Como o projeto inclui um módulo nativo em C++, você também precisará do **Node-Gyp** e das ferramentas de build correspondentes (Visual Studio Build Tools no Windows).

### Gerando a Build (Instalação)

```bash
# Clone este repositório
$ git clone https://github.com/Lintzz/ets2-servidor.git

# Acesse a pasta do projeto no terminal
$ cd ets2-servidor

# Instale as dependências e compile o addon nativo
$ npm install

# (se precisar recompilar só o addon depois de editar o .cpp)
$ npm run build:addon

# Gere o instalador da aplicação (Build final)
$ npm run make
```

> **Dica:** Após a conclusão do processo, o instalador executável (`.exe`) estará disponível dentro da pasta `out/make/`. 
> Se você desejar rodar o projeto apenas em modo de desenvolvimento, utilize o comando `npm start`.

> **Importante:** compile o addon sempre por `npm install` ou `npm run build:addon`, nunca com um `node-gyp rebuild` solto. O Electron Forge instala o `@electron/node-gyp`, que assume o `node_modules/.bin/node-gyp` e usa a toolchain clang-cl — o build "passa" sem erros, mas gera um binário que devolve números aleatórios. O servidor detecta isso na inicialização e avisa no log.

---

## :jigsaw: Instalando o plugin no jogo

Não precisa copiar DLL na mão. Abra o **ETS2 Servidor** e use o painel **"Plugin no jogo"**:

1. O app procura a instalação do ETS2 sozinho (registro do Steam + `libraryfolders.vdf`, então acha o jogo mesmo em outro HD). Se não achar, clique em **Escolher pasta** e aponte para a raiz do *Euro Truck Simulator 2*.
2. Clique em **Instalar plugin**. A pasta `bin\win_x64\plugins` é criada se não existir, e uma DLL já presente é preservada como `PluginETS2.dll.bak`.
3. Reinicie o jogo.

O painel mostra o estado atual: *não instalado*, *instalado mas de outra versão* ou *instalado e atualizado*. Se o ETS2 estiver aberto, o arquivo fica travado e o app avisa para fechar o jogo.

### De onde vem a DLL

O servidor consulta a última release de [`ets2-plugin`](https://github.com/Lintzz/ets2-plugin/releases/latest) e baixa a `PluginETS2.dll` de lá, guardando em cache no `userData`. Assim o plugin acompanha o repositório do plugin, e não a data em que o instalador do servidor foi gerado — basta publicar uma release nova para todo mundo receber.

O painel mostra a origem em uso (*release vX* ou *a que veio no instalador*) e o botão **Verificar** força uma nova consulta.

Se o GitHub estiver fora do ar, sem internet, ou se o download vier corrompido, o servidor cai para a DLL embutida — a instalação nunca fica bloqueada por causa da rede.

---

## :page_facing_up: Licença
Este projeto está sob a licença [MIT](./LICENSE).

---

## :mailbox_with_mail: Contato
Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)

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
- [x] **Autodescoberta de Rede:** Broadcast via UDP para pareamento automático e sem complicação com o tablet.
- [x] **Controle Remoto de Teclas:** Capacidade de receber comandos remotos para pressionar e segurar teclas no jogo usando RobotJS.
- [x] **Interface Oculta e Tray:** Aplicação Electron com janela customizada e suporte a modo silencioso no System Tray.

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

# Gere o instalador da aplicação (Build final)
$ npm run make
```

> **Dica:** Após a conclusão do processo, o instalador executável (`.exe`) estará disponível dentro da pasta `out/make/`. 
> Se você desejar rodar o projeto apenas em modo de desenvolvimento, utilize o comando `npm start`.

---

## :page_facing_up: Licença
Este projeto está sob a licença [MIT](./LICENSE).

---

## :mailbox_with_mail: Contato
Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)

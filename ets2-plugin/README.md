# :rocket: ETS2 Telemetry Plugin

<p align="center">
  <img src="https://img.shields.io/badge/C++-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
  <img src="https://img.shields.io/badge/Visual_Studio-5C2D91?style=for-the-badge&logo=visual%20studio&logoColor=white" alt="Visual Studio" />
  <img src="https://img.shields.io/badge/SCS_SDK-FFB900?style=for-the-badge&logo=scs&logoColor=white" alt="SCS SDK" />
</p>

> Um plugin poderoso para Euro Truck Simulator 2 que extrai dados completos de telemetria em tempo real e os compartilha em memória para uso em dashboards externos. Vá direto ao ponto!

## :clipboard: Tabela de Conteúdos
- [Sobre](#-sobre)
- [Features](#-features)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Como Rodar](#-como-rodar)
- [Licença](#-licença)
- [Contato](#-contato)

---

## :book: Sobre
Este projeto consiste em um plugin desenvolvido em C++ para o Euro Truck Simulator 2 utilizando o SCS SDK 1.14. O principal objetivo é acessar os dados da telemetria do jogo (como velocidade, RPM, marchas, luzes, desgaste de peças e informações de navegação) e exportá-los através de memória compartilhada (Shared Memory) sob o nome `MeuDashboardETS2_Full`. Com ele, é possível automatizar ou criar interfaces de painel customizadas, extraindo de forma eficiente o que o jogo processa em tempo real.

![Screenshot do app](https://via.placeholder.com/800x400?text=ETS2+Telemetry+Plugin)

---

## :sparkles: Features
O que o seu projeto já faz? 
- [x] Extração completa de dados de telemetria em tempo real do ETS2.
- [x] Leitura de status gerais, motor, transmissão, luzes, danos e navegação.
- [x] Compartilhamento de dados via Shared Memory (`MeuDashboardETS2_Full`) para comunicação com aplicativos de dashboard (apps externos).
- [x] Sincronização e resposta rápida e constante, sem afetar o desempenho do simulador.
- [x] Cabeçalho de versão na memória compartilhada: o servidor recusa a leitura se a DLL carregada no jogo for de outra versão, em vez de exibir dados corrompidos.

> **Ao alterar a struct `TelemetriaCompleta`:** ela é espelhada em `ets2-servidor/leitor_memoria.cpp`. Altere os dois arquivos juntos, incremente `TELEMETRIA_SCHEMA_VERSION` nos dois (e `SCHEMA_ESPERADO` em `ets2-servidor/protocolo.js`), recompile a DLL e o addon.

---

## :globe_with_meridians: Site Oficial & Como Funciona
Acesse o nosso site oficial para mais informações, downloads e guias rápidos: 
**[https://ets2-landing-page.vercel.app/](https://ets2-landing-page.vercel.app/)**

### 🔄 Como o ecossistema funciona?
O projeto é composto por 3 partes principais que trabalham em conjunto para trazer a telemetria do jogo para suas mãos:
1. **[Plugin (C++)](https://github.com/Lintzz/ets2-app/tree/main/ets2-plugin)**: Roda diretamente dentro do Euro Truck Simulator 2, lendo os dados de telemetria em tempo real e os disponibiliza na memória do PC (Shared Memory).
2. **[Servidor (Node.js/Electron)](https://github.com/Lintzz/ets2-app/tree/main/ets2-servidor)**: Roda no seu PC, lendo os dados disponibilizados pelo Plugin na memória. Ele cria um servidor WebSocket local e os transmite para a rede.
3. **[Dashboard (App Mobile/Web)](https://github.com/Lintzz/ets2-app/tree/main/ets2-dashboard-fixo)**: O seu dispositivo (celular/tablet) se conecta ao Servidor através do Wi-Fi (via WebSocket) para exibir todas as informações (velocidade, RPM, combustível, etc.) e pode enviar comandos de volta para o jogo.

---

## :computer: Tecnologias Utilizadas
As principais ferramentas, linguagens e bibliotecas usadas na construção do projeto:
- [C++](https://cplusplus.com/)
- [SCS SDK (1.14)](https://modding.scssoft.com/wiki/Documentation/Engine/SDK/Telemetry)
- [Visual Studio IDE](https://visualstudio.microsoft.com/)
- API do Windows (Memória Compartilhada)

---

## :rocket: Como Rodar

### Pré-requisitos
Antes de começar, você vai precisar ter instalado na sua máquina o [Git](https://git-scm.com/) e o [Visual Studio](https://visualstudio.microsoft.com/) com a carga de trabalho de desenvolvimento para Desktop em C++.

### Instalação e Execução

```bash
# Clone este repositório
$ git clone https://github.com/Lintzz/ets2-app.git

# Acesse a pasta do projeto no terminal
$ cd ets2-app/ets2-plugin/PluginETS2

# Abra a solução no Visual Studio
$ start PluginETS2.sln
```

1. Dentro do Visual Studio, selecione a configuração **Release** e a arquitetura **x64** (o ETS2 só carrega plugins x64).
2. Compile o projeto (`Ctrl + Shift + B`).
3. Pegue a `.dll` gerada na pasta de saída (ex: `x64/Release/PluginETS2.dll`).
4. Copie a `.dll` para a pasta de plugins do Euro Truck Simulator 2, normalmente em:  
   `C:\Program Files (x86)\Steam\steamapps\common\Euro Truck Simulator 2\bin\win_x64\plugins\`  
   *(Se a pasta "plugins" não existir, crie-a).*
5. Inicie o Euro Truck Simulator 2 no modo x64.

---

## :page_facing_up: Licença
Este projeto está sob a licença MIT.

---

## :email: Contato
Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)

# :rocket: ETS2 Dashboard Fixo

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
</p>

> Dashboard Fixo para Euro Truck Simulator 2, permitindo visualização de telemetria e widgets customizados. Vá direto ao ponto e tenha seus dados na tela!

## :clipboard: Tabela de Conteúdos
- [Sobre](#-sobre)
- [Features](#-features)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Como Rodar](#-como-rodar)
- [Licença](#-licença)
- [Contato](#-contato)

---

## :book: Sobre
Este projeto é um Dashboard customizado criado para rodar integrado ao Euro Truck Simulator 2. O objetivo é fornecer informações e telemetria essenciais do jogo em tempo real (via WebSocket) de forma acessível e com uma interface moderna, facilitando a experiência dos motoristas. 

Seja para automatizar a leitura de dados ou aprimorar sua simulação, o ETS2 Dashboard Fixo foi feito para entregar valor.

---

## :sparkles: Features
O que o seu projeto já faz? 
- [x] Dashboard interativo e em tempo real para o ETS2
- [x] Conexão direta com dados de telemetria (WebSocket, ~20 Hz)
- [x] Descoberta automática do servidor pelo Wi-Fi, varrendo a própria sub-rede — sem precisar de cabo nem digitar IP
- [x] Entrada manual de IP como alternativa, para redes onde a varredura não alcança
- [x] Biblioteca de Widgets customizáveis
- [x] Renderização avançada e dinâmica de ícones em SVG

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
- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/)
- [Socket.io](https://socket.io/)
- [React Native SVG](https://github.com/software-mansion/react-native-svg)

---

## :rocket: Como Rodar

### Pré-requisitos
Antes de começar, você vai precisar ter instalado na sua máquina o [Node.js](https://nodejs.org/en/) e o [Git](https://git-scm.com/). Além disso, precisará do [Expo CLI](https://docs.expo.dev/get-started/installation/) e de um dispositivo Android com um development build instalado (o Expo Go não serve, veja abaixo).

### Instalação e Execução

```bash
# Clone este repositório
$ git clone https://github.com/Lintzz/ets2-dashboard-fixo.git

# Acesse a pasta do projeto no terminal
$ cd ets2-dashboard-fixo

# Instale as dependências
$ npm install

# Execute a aplicação em modo de desenvolvimento
$ npx expo start --dev-client
```

> **Atenção:** o app usa módulos nativos (`expo-network`, AsyncStorage, gesture-handler, svg), então **não roda no Expo Go**. É preciso gerar um development build:
>
> ```bash
> $ npx expo run:android
> # ou, pela nuvem:
> $ eas build --profile development --platform android
> ```

### Gerando o APK localmente

```bash
$ npx expo prebuild --platform android --clean

# O template vem com MaxMetaspaceSize=512m, que estoura no build com a New
# Architecture. Aumente antes de compilar (a pasta android/ e recriada pelo
# prebuild, entao isso precisa ser refeito a cada prebuild):
$ sed -i 's|^org.gradle.jvmargs=.*|org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m|' android/gradle.properties

$ cd android
$ JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`. Ele e assinado com a chave de debug (padrao do template do Expo): instala por sideload normalmente, mas nao serve para a Play Store — para isso, gere um keystore proprio e ajuste o `signingConfig` de `release`.

### Conectando ao servidor
1. Abra o **ETS2 Servidor** no PC e confira o IP mostrado na janela.
2. Ponha o tablet e o PC na **mesma rede** (Wi-Fi de casa serve; não precisa de cabo).
3. Abra o app — ele encontra o servidor sozinho em alguns segundos e memoriza o endereço para as próximas vezes.
4. Se não encontrar, digite o IP do PC na própria tela de conexão.

---

## :page_facing_up: Licença
Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## :email: Contato
Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)

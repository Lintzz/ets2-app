# :bar_chart: Dashlz — app

> Aplicativo Expo / React Native que transforma um tablet Android no painel do
> caminhão: telemetria a 20 Hz e botões que acionam os comandos do jogo.

Parte do **[Dashlz](../README.md)** — comece por lá para entender o
conjunto, instalar e parear. Este arquivo cobre só o que é desta pasta.

## :jigsaw: Como este projeto se encaixa

É a ponta visível. Acha o [servidor](../ets2-servidor) sozinho varrendo a própria
sub-rede, conecta por WebSocket e desenha o painel com o que chega — mandando de
volta o que você aperta.

O `hooks/protocolo.js` é **espelho** de `ets2-servidor/protocolo.js`. Mudou um
lado, mude o outro.

---

## :sparkles: O que ele faz
- [x] Dashboard interativo e em tempo real para o ETS2
- [x] Conexão direta com dados de telemetria (WebSocket, ~20 Hz)
- [x] Descoberta automática do servidor pelo Wi-Fi, varrendo a própria sub-rede — sem precisar de cabo nem digitar IP
- [x] Entrada manual de IP como alternativa, para redes onde a varredura não alcança
- [x] Catálogo de 77 widgets (`WidgetLibrary.js`) num layout fixo — as 88 posições vivem em `INITIAL_WIDGETS`, e o editor visual que gerou os `id`s não faz parte deste repositório
- [x] Renderização avançada e dinâmica de ícones em SVG

---

## :rocket: Como Rodar

Precisa do [Node.js](https://nodejs.org/en/) e de um aparelho Android com um
development build instalado — o Expo Go não serve, veja o aviso abaixo.

```bash
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

O passo a passo — descoberta na rede, código de pareamento e o que fazer quando
não conecta — está no [README da raiz](../README.md#-parear-o-tablet).

---

Licença [MIT](./LICENSE). Contato e visão geral no
[README da raiz](../README.md).

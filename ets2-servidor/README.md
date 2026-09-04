# :satellite: ETS2 Servidor

> Aplicativo Electron que roda no PC: lê a telemetria da memória compartilhada
> pelo plugin e a transmite ao tablet por WebSocket, devolvendo os comandos ao
> teclado do jogo.

Parte do **[ETS2 Dashboard](../README.md)** — comece por lá para entender o
conjunto, instalar e parear. Este arquivo cobre só o que é desta pasta.

## :clipboard: Tabela de Conteúdos
- [Como este projeto se encaixa](#-como-este-projeto-se-encaixa)
- [O que ele faz](#-o-que-ele-faz)
- [Como rodar](#-como-rodar)
- [Instalando o plugin no jogo](#-instalando-o-plugin-no-jogo)

---

## :jigsaw: Como este projeto se encaixa

Fica no meio do caminho: o [plugin](../ets2-plugin) escreve a telemetria numa
região de memória do Windows, este servidor a lê 20x por segundo e a manda para
o [aplicativo](../ets2-dashboard-fixo) pelo Wi-Fi. Os botões do painel voltam por
aqui e viram teclas no jogo.

O desenho completo, o pareamento e o modelo de segurança estão no
[README da raiz](../README.md).

---

## :sparkles: O que ele faz
- [x] **Leitura Nativa de Memória:** Extração direta de telemetria do ETS2 em tempo real via C++ (node-addon-api).
- [x] **Transmissão WebSocket:** Envio contínuo e rápido dos dados do jogo para clientes conectados.
- [x] **Autodescoberta de Rede:** o app varre a própria sub-rede e identifica o servidor pelo endpoint `GET /ets2`; funciona por Wi-Fi comum, sem depender de broadcast. (O responder UDP na porta 48888 continua ativo por compatibilidade.)
- [x] **Controle Remoto de Teclas:** comandos remotos via RobotJS, restritos a uma allowlist de teclas — nenhum cliente consegue digitar texto arbitrário no PC.
- [x] **Pareamento de Aparelho:** o primeiro tablet que conecta é memorizado; os demais são recusados até você clicar em "Esquecer aparelho".
- [x] **Firewall Automático:** cria as regras de entrada para TCP 3000 e UDP 48888 em todos os perfis de rede (o motivo mais comum de funcionar no cabo e não no Wi-Fi).
- [x] **Instalação do Plugin pelo App:** detecta a pasta do ETS2 automaticamente (lê as bibliotecas do Steam), cria a pasta `plugins` e instala a DLL — com backup da versão anterior. A DLL vem da **última release de [ets2-plugin](https://github.com/Lintzz/ets2-app/releases)**, então o plugin fica sempre em dia sem precisar reinstalar o servidor; sem internet, usa a cópia que acompanha o instalador.
- [x] **Interface Oculta e Tray:** Aplicação Electron com janela customizada e suporte a modo silencioso no System Tray.

---

## :rocket: Como Rodar

### Pré-requisitos
Antes de começar, você vai precisar ter instalado na sua máquina o [Node.js](https://nodejs.org/en/) e o [Git](https://git-scm.com/). Como o projeto inclui um módulo nativo em C++, você também precisará do **Node-Gyp** e das ferramentas de build correspondentes (Visual Studio Build Tools no Windows).

### Gerando a Build (Instalação)

```bash
# Clone este repositório
$ git clone https://github.com/Lintzz/ets2-app.git

# Acesse a pasta do projeto no terminal
$ cd ets2-app/ets2-servidor

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

O servidor consulta a última release de [`ets2-plugin`](https://github.com/Lintzz/ets2-app/releases) e baixa a `PluginETS2.dll` de lá, guardando em cache no `userData`. No monorepo as releases do plugin levam a tag `plugin-vX.Y.Z`, e é por esse prefixo que o servidor as encontra. Assim o plugin acompanha a última release publicada, e não a data em que o instalador do servidor foi gerado — basta publicar uma release nova para todo mundo receber.

O painel mostra a origem em uso (*release vX* ou *a que veio no instalador*) e o botão **Verificar** força uma nova consulta.

Se o GitHub estiver fora do ar, sem internet, ou se o download vier corrompido, o servidor cai para a DLL embutida — a instalação nunca fica bloqueada por causa da rede.

---

## :page_facing_up: Licença
Este projeto está sob a licença [MIT](./LICENSE).

---

## :mailbox_with_mail: Contato
Alexandre Lintz - [alexandrelintz.1999@gmail.com](mailto:alexandrelintz.1999@gmail.com)

GitHub: [Lintzz](https://github.com/Lintzz)

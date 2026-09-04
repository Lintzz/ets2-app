# :electric_plug: ETS2 Telemetry Plugin

> DLL em C++ carregada pelo Euro Truck Simulator 2. Registra os canais de
> telemetria do SCS SDK 1.14 e escreve tudo numa região de memória compartilhada
> do Windows.

Parte do **[ETS2 Dashboard](../README.md)** — comece por lá para entender o
conjunto e instalar. Este arquivo cobre só o que é desta pasta.

## :clipboard: Tabela de Conteúdos
- [Como este projeto se encaixa](#-como-este-projeto-se-encaixa)
- [O que ele faz](#-o-que-ele-faz)
- [Como compilar](#-como-compilar)

---

## :jigsaw: Como este projeto se encaixa

É a origem de todo o dado. O jogo carrega esta DLL, ela recebe os callbacks do
SDK e escreve numa memória compartilhada que o
[servidor](../ets2-servidor) lê do outro lado.

A struct gravada aqui é **duplicada** em `ets2-servidor/leitor_memoria.cpp`, com
um número de versão nos dois lados. Mexeu numa, mexa na outra e suba a versão —
senão o servidor recusa a telemetria e avisa "plugin desatualizado".

---

## :sparkles: O que ele faz
- [x] Extração completa de dados de telemetria em tempo real do ETS2.
- [x] Leitura de status gerais, motor, transmissão, luzes, danos e navegação.
- [x] Compartilhamento de dados via Shared Memory (`MeuDashboardETS2_Full`) para comunicação com aplicativos de dashboard (apps externos).
- [x] Sincronização e resposta rápida e constante, sem afetar o desempenho do simulador.
- [x] Cabeçalho de versão na memória compartilhada: o servidor recusa a leitura se a DLL carregada no jogo for de outra versão, em vez de exibir dados corrompidos.

> **Ao alterar a struct `TelemetriaCompleta`:** ela é espelhada em `ets2-servidor/leitor_memoria.cpp`. Altere os dois arquivos juntos, incremente `TELEMETRIA_SCHEMA_VERSION` nos dois (e `SCHEMA_ESPERADO` em `ets2-servidor/protocolo.js`), recompile a DLL e o addon.

---

## :rocket: Como compilar

### Pré-requisitos
Antes de começar, você vai precisar ter instalado na sua máquina o [Git](https://git-scm.com/) e o [Visual Studio](https://visualstudio.microsoft.com/) com a carga de trabalho de desenvolvimento para Desktop em C++.

### Compilando e instalando no jogo

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

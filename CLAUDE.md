# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

`D:\Projetos\ets2-app` is a **single git repository** (`github.com/Lintzz/ets2-app`)
holding three projects that ship as one product:

| Folder | Role |
|---|---|
| `ets2-plugin` | C++ DLL loaded by Euro Truck Simulator 2 (SCS SDK 1.14) |
| `ets2-servidor` | Electron app on the PC — reads shared memory, serves WebSocket |
| `ets2-dashboard-fixo` | Expo / React Native tablet dashboard |
| `compartilhado` | widget catalogue + layout, read by the app **and** the server |

It used to be three separate repositories. They were merged because every change
in the history spanned two or three of them: two contracts are duplicated across
the folder boundaries (see the struct and `protocolo.js` below), and adding one
telemetry field touches all three. A change like that is now one atomic commit.
Their history was rewritten into these subdirectories with `git filter-repo`,
so `git log -- ets2-plugin/` and `git blame` reach back to 2025. The three
source repos have since been **deleted** from GitHub, which makes this the only
copy of that history — there is nowhere left to recover it from.

**Each project keeps its own `.gitignore`, and they must not be merged into one.**
`ets2-plugin/.gitignore` ignores `*.dll` (Visual Studio build output) while
`ets2-servidor` deliberately versions `recursos/PluginETS2.dll`; a single root
file would drop that DLL from the index. Same for the plugin's `x64/` and
`[Rr]elease/`, and the app's anchored `/android` and `/ios`. The root
`.gitignore` only covers `INSTALADORES/` and the loose icon masters.

### Releases live in one repo, separated by tag prefix

| Component | Tag | Consumer |
|---|---|---|
| servidor | `vX.Y.Z` — **no prefix** | update.electronjs.org, which parses the tag as semver |
| plugin | `plugin-vX.Y.Z` | `plugin-remoto.js`, which filters by this prefix |
| app | `app-vX.Y.Z` | none |

The asymmetry is deliberate. `plugin-remoto.js` must **not** use
`/releases/latest` — that endpoint returns the newest release by *date*,
ignoring the tag, so it would hand back a server release with no DLL in it. It
lists `/releases` and takes the first `plugin-` tagged one instead.

Comments, commit messages, log strings and identifiers are in Portuguese. Keep that convention.

## Architecture — the data path

```
ETS2 game process
  └─ PluginETS2.dll                       ets2-plugin/PluginETS2/PluginETS2/main.cpp
       registers ~55 SCS telemetry channels, each callback writes
       directly into a field of `struct TelemetriaCompleta`
       ↓
  Win32 shared memory, name L"MeuDashboardETS2_Full"
       ↓  read every 50 ms (20 Hz)
  Dashlz servidor (Electron)
    main.js    tray + frameless status.html window; fork()s server.js
               (contextIsolation + preload.js; no nodeIntegration)
    server.js  (child process, talks to main.js only via process.send)
      ├─ leitor_memoria.node   OpenFileMappingW → JS object   ets2-servidor/leitor_memoria.cpp
      ├─ HTTP  GET /ets2 on :3000      → identifies the server to the app's scan
      ├─ WebSocket  :3000 on 0.0.0.0   → telemetry out at 20 Hz, after a hello
      ├─ UDP :48888                    → replies to probes; also broadcasts (legacy)
      └─ robotjs                       → command in, allowlisted keys only
       ↓  Wi-Fi
  Dashboard app
    hooks/descoberta.js      scans own /24 with GET /ets2 → finds the server
    hooks/useTelemetry.js    discovery → WebSocket → hello → telemetry state
    screens/ConexaoScreen.js status + manual IP entry fallback
    screens/DashboardScreen.js  absolute-positioned grid, GRID_CELL_SIZE = 35
    WidgetLibrary.js         catalogue of ~76 widget definitions
```

### The struct contract (most important thing to know)

`struct TelemetriaCompleta` is **duplicated verbatim** in two files, both under `#pragma pack(push, 1)`:

- `ets2-plugin/PluginETS2/PluginETS2/main.cpp` — the writer
- `ets2-servidor/leitor_memoria.cpp` — the reader

Both carry a `schemaVersion` + `tamanhoStruct` header and `TELEMETRIA_SCHEMA_VERSION` (currently **2**), which must also match `SCHEMA_ESPERADO` in `ets2-servidor/protocolo.js`. The reader validates the header at runtime and refuses to interpret mismatched memory, so a divergence now surfaces as "plugin desatualizado" in the server log instead of garbage on the dashboard. **Still edit both structs together**, bump the version in both, rebuild the DLL, rebuild the native addon, and redeploy the DLL into the game's plugins folder.

Adding a new telemetry value end-to-end touches four places:
1. field in both `TelemetriaCompleta` structs
2. `REGISTRAR_CANAL(...)` line in `scs_telemetry_init` (`main.cpp`)
3. `SET_BOOL`/`SET_FLOAT`/`SET_INT` line in `LerDados` (`leitor_memoria.cpp`) — note that speeds are converted to km/h here and exposed under different names (`velocidadeKmh`, `velocidadeCruzeiroKmh`, `navLimiteVelocidadeKmh`)
4. a widget entry in `compartilhado/catalogo-widgets.json`
5. if the widget presses a key, add it to `TECLAS_PERMITIDAS` in `ets2-servidor/protocolo.js` — keys outside that allowlist are refused

### Widget model (dashboard app)

The catalogue and the layout are **JSON in `compartilhado/`**, at the repo root, because the server's mirror window (below) draws the same widgets. See `compartilhado/README.md` for the full grammar.

`catalogo-widgets.json` holds *what a widget is* — 77 entries of `w`/`h`, `type`, and `options` (`iconName`, the `key` sent to robotjs, `isContinuous`, `activeColor`). `layout-padrao.json` holds *where it is* — 88 items of `widgetKey` + `x`/`y`/`w`/`h` in grid cells, which override the catalogue's. `rehydrateLayout` (`screens/DashboardScreen.js`) merges the two. The layout is hardcoded (hence "fixo"); the timestamped `id`s came from a visual editor that is not part of this repo.

**No colour is hardcoded either.** Every widget colour comes from `options.cores`, a
partial object filled in from `compartilhado/cores.js` — `icone`/`iconeAtiva`,
`fundo`/`fundoAtiva`, `borda`/`bordaAtiva`, `rotulo`, `valor`, `alerta`/`alertaApagado`.
The green `#00FF7F` used to be a constant in `DashboardWidget.js` and in
`dashboardStyles.js`, and only `ColorArea`, `TextWidget` and alerts had any colour at
all; `color` and `activeColor` are gone, folded into `cores`. Buttons and displays could
not be painted before, so a colour picker in the editor would have had nowhere to write.

**Nothing in the catalogue is a function.** It used to carry `isActiveCheck: (t) => t.freioEstacionamento` and `value: (t) => ...`; a function cannot be serialised, so the catalogue could not leave the app's bundle. They are now descriptors — `ativoSe: { campo, op?, valor? | qualquer | todos }` and `valor: { campo, escala?, divisor?, casas?, sufixo?, formato? }` — interpreted by `compartilhado/avaliador.js`, the one file both sides call. `iconName` is always a string: a MaterialCommunityIcons name, or `"svg:Nome"`, resolved to a component by `WidgetLibrary.js` in the app and to a drawing from `ets2-servidor/dashboard/icones.json` in the server.

`WidgetLibrary.js` is now only that resolution step — it re-exports `WIDGET_LIBRARY` in the same shape as before, so the rest of the app did not change. `metro.config.js` needs `watchFolders` for Metro to see outside the app folder at all.

`DashboardWidget.js` dispatches on `config.type` (`ColorArea`, `TextWidget`, `CircularButton`, `IconButton`, `DataDisplay`, `FuelGauge`, `Alert`) and turns presses into `pressKey` / `holdKeyDown` + `holdKeyUp` depending on `options.isContinuous`.

### Layouts: presets and how one reaches the tablet

`compartilhado/layout-padrao.json` is the factory panel and the floor under everything —
it is what lets the tablet open with no server and no network. What the user creates
lives in `userData/layouts.json` on the PC (`ets2-servidor/layouts.js`), never in
`compartilhado/`, which is read-only inside `resources/` once packaged. `"padrao"` is
always a valid id and is **not** in the file, so "Restaurar padrão" survives a corrupt
one. Writes are atomic (tmp + rename): `salvarConfig` writes straight through, which is
fine for two keys and not for every preset the user has.

The active layout reaches the tablet over the WebSocket that is already paired, right
after the `welcome`, and again on every preset change — `main.js` → `serverProcess.send`
→ `server.js`, the same parent→child channel as `preview`. `validarLayout`
(`compartilhado/validar-layout.js`) runs on both ends, the server on write and the app on
receive; a bad item is dropped rather than taking the panel down.

**The server only sends `layout` to a client that declared `recursos: ["layout"]` in its
`hello`.** This is not a nicety. The app's `onmessage` ends in `setTelemetry(dados)`, so
anything it does not recognise becomes telemetry — an older APK would render the layout
object as readings. The server updates itself through update.electronjs.org while the APK
does not, so that pairing genuinely occurs. Bumping `PROTOCOLO_VERSAO` would have been the
wrong lever: `server.js` refuses anything below the current version, so every older APK
would stop connecting.

On the app side `useTelemetry` intercepts the message before that fallback, caches it in
AsyncStorage (`ets2:layout`), and `DashboardScreen` picks its source in order:
**just received → cached → bundled factory layout**.

A layout may declare `tela: { colunas, linhas }` in cells — the tablet's screen
frame, which the editor draws and uses to flag widgets that fall outside it. Without
it the old behaviour holds: the app measures the bounds of what exists and centres the
block. `layout-padrao.json` stays a bare array, because changing the file's shape would
break the app's bundled fallback. A widget outside the frame is **reported, never
dropped** — what fits on the tablet is the owner's call.

### The mirror window (server)

`ets2-servidor/dashboard.html` draws the same panel on the PC and animates it with real telemetry — **read-only**: there is no `press_key` path out of it, on purpose. Opened from "Abrir painel" in `status.html` or from the tray.

The catalogue is read and evaluated in the **main process** (`painel.js`), not in the preload: Electron preloads are sandboxed, where `require` only yields `electron`/`events`/`timers`/`url` and loading `compartilhado/` fails with `module not found: path`. The window gets the widget list once over `dashboard:painel`, then one frame at a time carrying only each widget's state (lit/unlit and the text). So `dashboard_renderer.js` is pure DOM and cannot drift from the app on its own.

`server.js` only ran the 20 Hz loop while a tablet was authenticated. The window now counts as a consumer: `main.js` sends `{type:"preview", ativo}` when it opens and closes, and `previewAtivo` keeps the loop alive — that is what lets you check a layout on the PC with no tablet in reach. Frames to the window are throttled to every third tick (~7 Hz); the tablet still gets all 20. `startServerProcess` re-sends the flag after each fork, otherwise "Reiniciar servidor" would leave the window frozen.

The window's header also carries the preset bar — pick, duplicate, rename, delete. There
is no grid editing yet; it is the shell the editor will live in. Switching preset makes
`main.js` reload the window, because the renderer builds its widgets once at load.

### The editor

`dashboard_editor.js` turns the mirror into an editor: select, drag, resize, delete and
add widgets from the palette, with the grid and the screen frame drawn, Ctrl+Z, and an
explicit Salvar. It works on the **raw layout** — the same shape that goes to disk and to
the tablet — so nothing is translated on the way. Dragging moves the node's style
directly; only structural changes go through `remontar()`.

Two details that are easy to get wrong. Pointer deltas are divided by the zoom scale,
or the widget drifts away from the cursor at any zoom but 100% — which is the normal
case, since the window is usually smaller than the panel. And entering the editor
*ensures* a `tela`, deriving one from the current bounds if absent: with a frame the
grid origin is (0,0) and the arithmetic stays direct. The factory layout has no frame
and is not editable, so it is never touched by this.

Editing `padrao` is refused; the Editar button duplicates it first. While there are
unsaved changes, newly added widgets stay unlit — `avaliarPainel` runs in the main
process over the *saved* layout and does not know the new ids yet. Freezing telemetry
in edit mode would have hidden that; this way nothing lies.

Icons: the window is plain HTML, with no MaterialCommunityIcons font and no SVG transformer. `npm run gerar:icones` extracts the 35 MDI icons the catalogue names (from `@mdi/js`, a devDependency) plus the 12 own SVGs (read from the app's `assets/`) into `dashboard/icones.json` — 24 KB, against 1.3 MB for the whole `.ttf`. Re-run it after adding a widget with a new icon.

## Commands

### ets2-plugin

Built only from Visual Studio (VS 2022, toolset v143) — there is no CLI build script.

```bash
start ets2-plugin/PluginETS2/PluginETS2.sln
```

- Build **x64** — that is what ETS2 loads. Include paths are relative (`$(SolutionDir)..\SDK\scs_sdk_1_14\...`), so the solution builds from any checkout location.
- Exports are pinned by `main.def` (`scs_telemetry_init`, `scs_telemetry_shutdown`).
- Deploy: copy `x64/Release/PluginETS2.dll` to `...\Euro Truck Simulator 2\bin\win_x64\plugins\` (create the folder if missing) and launch the game in x64.

### ets2-servidor

```bash
cd ets2-servidor
npm install              # runs scripts/build-addon.js (needs VS Build Tools, C++ workload)
npm run build:addon      # rebuild just leitor_memoria.node after editing the .cpp
npm start                # electron .
npm run make             # electron-forge → installer in out/make/
```

**Never build the addon with a bare `node-gyp rebuild`.** Electron Forge pulls in
`@electron/node-gyp`, which hijacks `node_modules/.bin/node-gyp` and selects the
clang-cl toolchain; that produces a `.node` that links cleanly but returns
garbage for every `Napi::Number` (values differ on each run). `scripts/build-addon.js`
resolves the real `node-gyp` by path to avoid this, and `server.js` verifies
`leitorMemoria.schemaVersion` at startup so a bad build is reported instead of
silently corrupting telemetry. Both native modules are N-API, so no rebuild for
Electron is needed — `rebuildConfig` is `{ onlyModules: [] }` on purpose.

### ets2-dashboard-fixo

```bash
cd ets2-dashboard-fixo
npm install
npx expo start --dev-client   # NOT Expo Go
npm run android               # expo run:android
eas build --profile development --platform android
```

Expo SDK 57 / RN 0.86 (New Architecture). The app uses native modules
(`expo-network`, async-storage, gesture-handler, svg), so **Expo Go will not
work** — a development build (`expo-dev-client`) or `expo run:android` is
required. `metro.config.js` routes `.svg` through `react-native-svg-transformer`,
so SVGs in `assets/` are imported as React components (see `SvgLibrary.js`).
Run `npx expo-doctor` after touching dependencies; it currently passes 21/21.

Local release APK (JDK 21 from Android Studio's JBR, SDK 36):

```bash
npx expo prebuild --platform android --clean
# the template ships MaxMetaspaceSize=512m, which OOMs the New Architecture
# codegen; android/ is regenerated by prebuild so this must be redone each time
sed -i 's|^org.gradle.jvmargs=.*|org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m|' android/gradle.properties
cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`, signed with the
debug keystore (Expo template default) — fine for sideloading, not for the Play
Store. `android/` and `ios/` are gitignored.

`ets2-servidor` has `npm test` (`testes/pareamento.js`, no dependencies beyond
`ws`). There is no linter or formatter in any of the three projects, and the
other two have no tests.

## Installing the plugin into the game

`ets2-servidor/instalador-plugin.js` locates ETS2 (Steam path from the registry,
then every library in `steamapps/libraryfolders.vdf`), validates a folder by the
presence of `bin/win_x64/eurotrucks2.exe`, creates `bin/win_x64/plugins`, backs
up any existing DLL as `.bak`, and copies the bundled one. It is a no-op when
the hashes already match, and reports a "close the game" message on EBUSY/EPERM.

`plugin-remoto.js` picks which DLL to install: it lists the repo's releases,
takes the newest one tagged `plugin-*` that actually carries a `PluginETS2.dll`
asset, downloads it into `userData/plugin-cache/PluginETS2-<tag>.dll` (reused on
later runs), and falls back to the bundled copy whenever the network, the API,
or the payload fails — the download is rejected unless it starts with `MZ` and
has a sane size. This keeps the plugin current without reinstalling the server:
publishing a new `plugin-vX.Y.Z` release is enough. Resolution is cached per run;
`plugin:verificar-atualizacao` forces a re-check.

The fallback DLL ships from `recursos/PluginETS2.dll` (committed) and reaches the
packaged app through `packagerConfig.extraResource`, so at runtime it is
`process.resourcesPath/PluginETS2.dll` when `app.isPackaged`, else
`__dirname/recursos/`. Note `userData` is `%APPDATA%\dashlz` (from
package.json `name`), not the packager's display name. It was `ets2_servidor`
until the rename to Dashlz, so an install from before that starts with no
`config.json` and no pairing. The chosen game folder is remembered in
`config.json` under Electron's `userData`. UI lives in the "Plugin no jogo"
panel of `status.html`; IPC uses `ipcMain.handle("plugin:*")`.

**After changing `main.cpp`, rebuild the DLL and refresh `recursos/PluginETS2.dll`** —
otherwise the app ships the old schema and the server refuses the telemetry.

## Getting the APK onto the tablet

The "Instalar no tablet" card in `status.html` shows a QR code that points at the
`.apk` of the newest `app-vX.Y.Z` release. `app-remoto.js` resolves it the same way
`plugin-remoto.js` resolves the DLL — list `/releases`, take the first non-draft
one whose tag carries the prefix, never `/releases/latest` — with one difference:
the asset is matched by the `.apk` **extension**, not by an exact filename, because
the published asset is named by Expo (`2.-.ETS2.Dashboard.1.2.0.apk`) rather than
by us.

The QR encodes the GitHub URL, so the tablet needs its own internet. Serving the
file from the server itself was considered and dropped: it would mean caching
~75 MB in `userData` and opening a new public HTTP route, to cover only a tablet
on a LAN with no internet at all.

`gerarQr()` produces **SVG** (the window resizes; a PNG would blur) and hands it
over IPC as a `data:` URI, which the renderer assigns to `img.src` — no markup
crosses the `contextIsolation` boundary. That URI only renders because the CSP in
`status.html` carries `img-src 'self' data:`; without it the image is silently
blocked and the panel shows nothing but its alt text. Resolution is cached per
run, like the plugin's; the **Verificar** button forces a re-check.

## Discovery and pairing

The app finds the server by **scanning its own /24** (`hooks/descoberta.js`): it
reads the device IP with `expo-network`, then issues `GET http://<ip>:3000/ets2`
across the subnet (24 in flight, 800 ms timeout each, nearest addresses first)
and takes the first host that answers with `{"t":"ets2-server"}`. The last
working address is cached in AsyncStorage and tried first, so only the first
launch pays the ~7 s scan.

This replaced a server-side UDP broadcast, which is why the app used to work
only over USB tethering: many routers do not forward directed broadcast from
the wired side to the Wi-Fi radio, and Android drops broadcast frames without a
multicast lock. The scan is ordinary unicast, so it crosses any router. The
server still answers UDP probes and broadcasts on :48888 for compatibility, but
the app no longer depends on it. `ConexaoScreen.js` offers manual IP entry as
the guaranteed fallback.

Pairing (protocol 3): the server speaks first, sending
`{type:"challenge", nonce, pareado}`. The client answers with `hello` within 5 s
or the socket is closed:

- **first time** — `{type:"hello", protocolo, deviceId, nome, codigo}`, where
  `codigo` is the 6-digit code shown in the status window (single use, expires in
  10 min, regenerated by "Gerar outro código"). On success the server draws a
  32-byte secret, saves it in `pareamento.json` (mode 0600, in `userData`) and
  returns it once in the `welcome`.
- **afterwards** — `{..., prova}` where `prova` is
  `SHA-256(nonce + ":" + segredo)`. The secret never travels again, so sniffing
  the network yields a proof that is useless for the next nonce.

Refusals come back as `{type:"denied", reason}` with `reason` from `RECUSA` in
`protocolo.js`. Protocol 2 (the old "first device on the network wins") is
refused on purpose — a guest on the Wi-Fi, or a web page open in any browser on
the LAN, could take the slot and inject keystrokes. `verifyClient` also rejects
any handshake carrying an `Origin` header, which is exactly what a browser sends
and a native app never does. Clear the pairing from the tray menu or the status
window ("Esquecer aparelho"); that also mints a new code.

`npm test` (`testes/pareamento.js`) boots the real `server.js` on port 31998
with robotjs and the native addon stubbed, and covers all ten accept/refuse
paths, including replay and the browser `Origin` case.

## Operational notes

- Keys are checked against `TECLAS_PERMITIDAS` (`protocolo.js`) before reaching
  robotjs, and keys still held when a client disconnects are released.
- Three states reach the app: full telemetry object (playing), `{jogoRodando:false, inMenu:true}` (menu/paused/idle), and `null` (game not running or not connected). `DashboardScreen` renders `ConexaoScreen` only for `null`. In the menu the grid stays on screen with `aoVivo={false}` — buttons keep working (the ESC widget is how you get back into the game) while the readouts show `--` instead of stale or zeroed values.
- `main.js` runs `firewall.js` at startup to add inbound rules for TCP 3000 / UDP 48888 with `profile=private,domain` — **not** `any`, which used to leave the port open on Public networks (hotel, café). An existing rule from an older install is rewritten with `netsh ... set rule` (idempotent, locale-independent). Creating a rule needs admin, and the app runs
  unelevated on purpose, so when one is missing `garantirRegrasElevado()` writes the
  pending `netsh` lines into a temp `.cmd` and runs it through PowerShell
  `Start-Process -Verb RunAs` — **one** UAC for both rules, and only the `netsh` is
  elevated, never the server or robotjs. The result is rechecked with
  `estadoDasRegras()` rather than trusted from the exit code, since a cancelled UAC
  is indistinguishable from a real failure by message alone. A cancel is remembered
  as `firewallElevacaoRecusada` in `config.json` so the app never nags; the
  "Liberar no Firewall" card in `status.html` (hidden while the rules are in place)
  clears that flag and asks again. The manual `netsh` line stays in the log as the
  last resort. The Squirrel installer cannot ask for admin itself — it installs
  per-user and avoids UAC by design, and changing that would break the
  update.electronjs.org flow. Playing on a network Windows marked as Public means changing it to Private, which is the correct setting for a home network anyway.
- Everything logged to the window is also appended to `userData/logs/servidor.log` (`registro.js`, 1 MB × 4 files rotation). "Abrir arquivo" in the log header opens the folder — that is what to ask for when someone reports "it doesn't connect".
- `atualizador.js` wires `update-electron-app` to update.electronjs.org, which reads the public GitHub releases. It only runs from a packaged install on Windows, needs the `npm run make` artifacts attached to the release, and does not remove the SmartScreen warning — that needs a code-signing certificate.
- Interface selection is scored, not first-come (`pontuar()` in `server.js`): VPN and virtual adapters are penalised. On this machine a Radmin VPN adapter (26.x/8) sorts before the real Ethernet, and the old `addresses[0]` logic announced that unreachable address.
- The Electron window uses `contextIsolation: true` with `preload.js`; the renderer talks to the main process only through `window.servidor`. `status.html` has no CDN dependency — its fonts are base64-embedded in `fontes/fontes.css` — so it renders correctly offline.
- On Android the system bars are hidden natively, through the `expo-status-bar` and `expo-navigation-bar` config plugins in `app.json` (they write `styles.xml`). Hiding them only from JS, as before, left the bar drawn over the dashboard under the edge-to-edge mode Android 15 forces. `App.js` still calls `NavigationBar.setHidden(true)` when the app resumes; `setVisibilityAsync`/`setBehaviorAsync` are deprecated in expo-navigation-bar 57 and must not be reintroduced.

## Icons

The brand mark is a white gauge with an "Lz" wordmark, on `#0B0B0B`. Two masters
exist: **rounded** (alpha corners) and **square**. Which one goes where is not a
preference — it depends on whether the platform applies its own mask.

| Target | File | Source | Why |
|---|---|---|---|
| Windows exe + tray | `ets2-servidor/icon.ico` | rounded | Windows never masks; a square would be a hard black block |
| Android legacy / stores | `assets/icon.png` | **square**, as-is | used as-is by old launchers |
| Android adaptive fg | `assets/adaptive-icon.png` | square, artwork at full size | the system masks it — see below |
| Android themed | `assets/monochrome-icon.png` | same as adaptive | Android 13+ tints it |
| Splash | `assets/splash-icon.png` | artwork only, transparent | floats on the splash background |

The adaptive foreground carries the master's artwork **unchanged in
composition and at full size** — the gauge plus the "Lz" in its bottom-right
corner, exactly the arrangement the Windows tray shows, in the same position it
occupies on the 1024 master. An adaptive icon guarantees only a central circle
of 66/108 of the canvas, so at this size a circular mask (the Pixel launcher's)
eats the "Lz". **That is a deliberate choice by the owner** — the mark reads
bigger and the clipping is accepted; do not shrink the artwork back down. (An
earlier version scaled it to 444 px, 43% of the canvas, so nothing was clipped.)
The dark plate is not painted into the foreground — `adaptiveIcon.backgroundColor` `#0B0B0B` in `app.json` is the
background layer and the mask gives it its shape. An earlier version recomposed
the artwork instead (gauge centred, "Lz" moved into the gauge's open bottom) to
buy size; that was dropped so the phone and the tray show the same mark. Masters
live in `ets2-dashboard-fixo/extras/icone/` and
`ets2-servidor/icon-fonte-1024.png`.

Regenerating (ImageMagick 7). First lift the artwork off its plate — the master's
background is `#0B0B0B`, not pure black, so the `-level` is what stops a 4% grey
veil from surviving into the alpha:

```bash
magick "lz-icon-1024-quadrado.png" -alpha off -colorspace sRGB \
  \( +clone -colorspace gray -level 8%,100% \) -compose CopyOpacity -composite \
  -fill white -colorize 100 -colorspace sRGB arte.png
```

`arte.png` is already the 1024 canvas with the artwork where the master puts it,
so no trim or resize follows — it is written straight out as `adaptive-icon.png`
and `monochrome-icon.png`, byte for byte the same file:

```bash
magick arte.png -colorspace sRGB -type TrueColorAlpha PNG32:adaptive-icon.png
```

`assets/icon.png` is the square master copied verbatim, plate and all.

For `icon.ico`, sizes
16/24/32 get `-channel RGB -level 0%,72%` before packing: the 1 px arc turns mid
grey in a plain downscale and the tray icon comes out muddy.

Squirrel's `iconUrl` (the icon shown in Programs and Features) must be a public
URL to an ICO, so it points at
`raw.githubusercontent.com/Lintzz/ets2-app/main/ets2-servidor/icon.ico` — the repo's own
committed icon. Replacing `icon.ico` and pushing is therefore enough to update
it; there is no third-party host in the loop. Note `raw` caches for a few
minutes, so it lags a push. `setupIcon` is the local `icon.ico`.

## Still missing for a "hand it to strangers" release

Code signing is **deliberately out of scope** — the owner has decided the
Windows installer stays unsigned (SmartScreen will warn on every install) and
the APK keeps the Expo debug keystore. Do not propose it again.

- The plugin DLL downloaded from GitHub is validated only by the `MZ` magic and a size range (`plugin-remoto.js`) — no hash or signature check.
- Traffic is plain `ws://` (`usesCleartextTraffic: true` in `app.json`).
- No linter or formatter in any of the three repos; `npm test` exists only in `ets2-servidor`, and there is no CI.

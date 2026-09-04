#include <windows.h>
#include <napi.h>

// ============================================================================
// ATENÇÃO: este arquivo espelha ets2-plugin/PluginETS2/PluginETS2/main.cpp.
// Qualquer campo adicionado/removido/reordenado em TelemetriaCompleta precisa
// ser replicado LÁ e AQUI, e TELEMETRIA_SCHEMA_VERSION precisa ser incrementada
// nos dois. O cabeçalho (schemaVersion + tamanhoStruct) faz a verificação em
// tempo de execução: se não bater, recusamos a leitura em vez de interpretar
// lixo (o que antes gerava valores aleatórios no painel, sem nenhum erro).
// ============================================================================
#define TELEMETRIA_SCHEMA_VERSION 2u

#pragma pack(push, 1)

struct dvector { double x, y, z; };
struct euler { float heading, pitch, roll; };
struct dplacement { dvector position; euler orientation; };

struct TelemetriaCompleta {
    unsigned int schemaVersion;
    unsigned int tamanhoStruct;

    bool jogoRodando;
    bool reboqueConectado;
    float odometro;
    float escalaDoJogo;
    bool electricoLigado;
    bool motorLigado;
    float velocidade;
    float rpm;
    int marcha;
    int marchaPainel;
    float combustivel;
    float tempAgua;
    float pressaoOleo;
    float tempOleo;
    float voltagemBateria;
    float nivelAdBlue;
    float volante;
    float acelerador;
    float freio;
    bool freioMotor;
    unsigned int retarder;
    bool freioEstacionamento;
    bool bloqueioDiferencial;
    float velocidadeCruzeiro;
    bool luzesEstacionamento;
    bool farolBaixo;
    bool farolAlto;
    bool piscaEsquerdoLogico;
    bool piscaDireitoLogico;
    bool piscaEsquerdoOn;
    bool piscaDireitoOn;
    bool piscaAlerta;
    bool luzFreio;
    bool luzRe;
    bool luzGiroflex;
    bool avisoPressaoAr;
    bool avisoPressaoOleo;
    bool avisoTempAgua;
    bool avisoVoltagemBateria;
    bool avisoCombustivel;
    bool avisoAdBlue;
    bool eixoCaminhaoLevantado;
    bool eixoReboqueLevantado;
    float danoMotor;
    float danoTransmissao;
    float danoCabine;
    float danoChassi;
    float danoRodas;
    float danoReboque;
    float danoCarga;
    float navDistancia;
    float navTempoEstimado;
    float navLimiteVelocidade;
    float fuelRange;
    dplacement truckPlacement;
};

// Só o cabeçalho, para conseguir ler a versão mesmo quando o plugin instalado
// publica uma struct de tamanho diferente da nossa.
struct TelemetriaCabecalho {
    unsigned int schemaVersion;
    unsigned int tamanhoStruct;
};

#pragma pack(pop)

const wchar_t* NOME_MEMORIA_COMPARTILHADA = L"MeuDashboardETS2_Full";

// Objeto devolvido quando o plugin carregado no jogo não é da mesma versão
// deste servidor. O server.js transforma isso numa mensagem clara pedindo a
// recompilação da DLL, em vez de mostrar telemetria corrompida.
static Napi::Value ErroDeSchema(Napi::Env env, unsigned int versaoPlugin, unsigned int tamanhoPlugin) {
    Napi::Object r = Napi::Object::New(env);
    r.Set("erroSchema", Napi::Boolean::New(env, true));
    r.Set("versaoPlugin", Napi::Number::New(env, versaoPlugin));
    r.Set("versaoEsperada", Napi::Number::New(env, TELEMETRIA_SCHEMA_VERSION));
    r.Set("tamanhoPlugin", Napi::Number::New(env, tamanhoPlugin));
    r.Set("tamanhoEsperado", Napi::Number::New(env, static_cast<double>(sizeof(TelemetriaCompleta))));
    return r;
}

Napi::Value LerDados(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // O handle é aberto e fechado a cada leitura de propósito: manter um handle
    // aberto mantém a seção viva depois que o jogo fecha, e nunca mais
    // detectaríamos "jogo fechado".
    HANDLE hMapFile = OpenFileMappingW(FILE_MAP_READ, FALSE, NOME_MEMORIA_COMPARTILHADA);
    if (hMapFile == NULL) {
        return env.Null(); // jogo fechado / plugin não carregado
    }

    // Tamanho 0 = mapeia a seção inteira, qualquer que seja o tamanho que o
    // plugin instalado tenha publicado.
    void* view = MapViewOfFile(hMapFile, FILE_MAP_READ, 0, 0, 0);
    if (view == nullptr) {
        CloseHandle(hMapFile);
        return env.Null();
    }

    MEMORY_BASIC_INFORMATION mbi;
    SIZE_T tamanhoRegiao = 0;
    if (VirtualQuery(view, &mbi, sizeof(mbi)) == sizeof(mbi)) {
        tamanhoRegiao = mbi.RegionSize;
    }

    if (tamanhoRegiao < sizeof(TelemetriaCabecalho)) {
        UnmapViewOfFile(view);
        CloseHandle(hMapFile);
        return ErroDeSchema(env, 0, 0);
    }

    const TelemetriaCabecalho* cabecalho = static_cast<const TelemetriaCabecalho*>(view);
    if (cabecalho->schemaVersion != TELEMETRIA_SCHEMA_VERSION ||
        cabecalho->tamanhoStruct != sizeof(TelemetriaCompleta) ||
        tamanhoRegiao < sizeof(TelemetriaCompleta)) {
        Napi::Value erro = ErroDeSchema(env, cabecalho->schemaVersion, cabecalho->tamanhoStruct);
        UnmapViewOfFile(view);
        CloseHandle(hMapFile);
        return erro;
    }

    const TelemetriaCompleta* dadosCompartilhados = static_cast<const TelemetriaCompleta*>(view);

    Napi::Object r = Napi::Object::New(env);

    #define SET_BOOL(nome) r.Set(#nome, Napi::Boolean::New(env, dadosCompartilhados->nome))
    #define SET_FLOAT(nome) r.Set(#nome, Napi::Number::New(env, dadosCompartilhados->nome))
    #define SET_INT(nome) r.Set(#nome, Napi::Number::New(env, dadosCompartilhados->nome))

    SET_BOOL(jogoRodando); SET_BOOL(reboqueConectado); SET_FLOAT(odometro); SET_FLOAT(escalaDoJogo);
    SET_BOOL(electricoLigado);
    SET_BOOL(motorLigado);
    r.Set("velocidadeKmh", Napi::Number::New(env, dadosCompartilhados->velocidade * 3.6f));
    SET_FLOAT(rpm); SET_INT(marcha); SET_INT(marchaPainel);
    SET_FLOAT(combustivel); SET_FLOAT(fuelRange);
    SET_FLOAT(tempAgua); SET_FLOAT(pressaoOleo); SET_FLOAT(tempOleo); SET_FLOAT(voltagemBateria); SET_FLOAT(nivelAdBlue);
    SET_FLOAT(volante); SET_FLOAT(acelerador); SET_FLOAT(freio); SET_BOOL(freioMotor); SET_INT(retarder); SET_BOOL(freioEstacionamento); SET_BOOL(bloqueioDiferencial);
    r.Set("velocidadeCruzeiroKmh", Napi::Number::New(env, dadosCompartilhados->velocidadeCruzeiro * 3.6f));
    SET_BOOL(luzesEstacionamento); SET_BOOL(farolBaixo); SET_BOOL(farolAlto); SET_BOOL(piscaEsquerdoLogico); SET_BOOL(piscaDireitoLogico);
    SET_BOOL(piscaEsquerdoOn); SET_BOOL(piscaDireitoOn); SET_BOOL(piscaAlerta); SET_BOOL(luzFreio); SET_BOOL(luzRe); SET_BOOL(luzGiroflex);
    SET_BOOL(avisoPressaoAr); SET_BOOL(avisoPressaoOleo); SET_BOOL(avisoTempAgua); SET_BOOL(avisoVoltagemBateria); SET_BOOL(avisoCombustivel); SET_BOOL(avisoAdBlue);
    SET_BOOL(eixoCaminhaoLevantado); SET_BOOL(eixoReboqueLevantado);
    SET_FLOAT(danoMotor); SET_FLOAT(danoTransmissao); SET_FLOAT(danoCabine); SET_FLOAT(danoChassi); SET_FLOAT(danoRodas); SET_FLOAT(danoReboque); SET_FLOAT(danoCarga);
    SET_FLOAT(navDistancia); SET_FLOAT(navTempoEstimado);
    r.Set("navLimiteVelocidadeKmh", Napi::Number::New(env, dadosCompartilhados->navLimiteVelocidade * 3.6f));

    // Posição/orientação do caminhão no mundo. O plugin sempre registrou esse
    // canal, mas até agora ele nunca era exposto ao JS.
    Napi::Object pos = Napi::Object::New(env);
    pos.Set("x", Napi::Number::New(env, dadosCompartilhados->truckPlacement.position.x));
    pos.Set("y", Napi::Number::New(env, dadosCompartilhados->truckPlacement.position.y));
    pos.Set("z", Napi::Number::New(env, dadosCompartilhados->truckPlacement.position.z));
    pos.Set("heading", Napi::Number::New(env, dadosCompartilhados->truckPlacement.orientation.heading));
    pos.Set("pitch", Napi::Number::New(env, dadosCompartilhados->truckPlacement.orientation.pitch));
    pos.Set("roll", Napi::Number::New(env, dadosCompartilhados->truckPlacement.orientation.roll));
    r.Set("posicao", pos);

    #undef SET_BOOL
    #undef SET_FLOAT
    #undef SET_INT

    UnmapViewOfFile(view);
    CloseHandle(hMapFile);

    return r;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("lerDados", Napi::Function::New(env, LerDados));
    exports.Set("schemaVersion", Napi::Number::New(env, TELEMETRIA_SCHEMA_VERSION));
    return exports;
}

NODE_API_MODULE(leitor_memoria, Init)

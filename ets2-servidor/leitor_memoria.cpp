#include <windows.h>
#include <napi.h>

#pragma pack(push, 1)

// ESTRUTURA IDÊNTICA À DO PLUGIN ATUALIZADO
struct dvector { double x, y, z; };
struct euler { float heading, pitch, roll; };
struct dplacement { dvector position; euler orientation; };

struct TelemetriaCompleta {
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
    float navProximaCurva;
    float navDistancia;
    float navTempoEstimado;
    float navLimiteVelocidade;
    float fuelRange;
    dplacement truckPlacement;
};
#pragma pack(pop)

const wchar_t* NOME_MEMORIA_COMPARTILHADA = L"MeuDashboardETS2_Full";

Napi::Value LerDados(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    HANDLE hMapFile = OpenFileMappingW(FILE_MAP_READ, FALSE, NOME_MEMORIA_COMPARTILHADA);

    // Se não conseguiu abrir o mapeamento, o jogo não está a correr.
    if (hMapFile == NULL) {
        return env.Null();
    }

    TelemetriaCompleta* dadosCompartilhados = static_cast<TelemetriaCompleta*>(MapViewOfFile(hMapFile, FILE_MAP_READ, 0, 0, sizeof(TelemetriaCompleta)));

    // Se conseguiu abrir mas não conseguiu mapear, ou se o jogo reporta que não está a correr.
    if (dadosCompartilhados == nullptr) {
        UnmapViewOfFile(dadosCompartilhados);
        CloseHandle(hMapFile);
        return env.Null();
    }

    // Se chegamos aqui, os dados são válidos. Copiamos e depois fechamos tudo.
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
    // Erro de digitação corrigido aqui
    r.Set("navLimiteVelocidadeKmh", Napi::Number::New(env, dadosCompartilhados->navLimiteVelocidade * 3.6f));

    #undef SET_BOOL
    #undef SET_FLOAT
    #undef SET_INT

    // Limpeza final dos recursos após a leitura
    UnmapViewOfFile(dadosCompartilhados);
    CloseHandle(hMapFile);

    return r;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("lerDados", Napi::Function::New(env, LerDados));
    return exports;
}

NODE_API_MODULE(leitor_memoria, Init)
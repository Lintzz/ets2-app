#include <windows.h>
#include "scssdk_telemetry.h"
#include "eurotrucks2/scssdk_telemetry_eut2.h"

#pragma pack(push, 1)

struct dvector { double x, y, z; };
struct euler { float heading, pitch, roll; };
struct dplacement { dvector position; euler orientation; };

struct TelemetriaCompleta {
    // --- GERAL E STATUS ---
    bool jogoRodando;
    bool reboqueConectado;
    float odometro;
    float escalaDoJogo;

    // --- MOTOR E TRANSMISSÃO ---
    bool electricoLigado; // *** NOVO CAMPO ***
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

    // ... (resto da estrutura continua igual)
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
HANDLE hMapFile;
TelemetriaCompleta* dadosCompartilhados = nullptr;

// --- Callbacks ---
SCSAPI_VOID callback_generico_float(const scs_string_t, const scs_u32_t, const scs_value_t* const value, const scs_context_t context) {
    if (dadosCompartilhados && value) { *static_cast<float*>(context) = value->value_float.value; }
}
SCSAPI_VOID callback_generico_s32(const scs_string_t, const scs_u32_t, const scs_value_t* const value, const scs_context_t context) {
    if (dadosCompartilhados && value) { *static_cast<int*>(context) = value->value_s32.value; }
}
SCSAPI_VOID callback_generico_bool(const scs_string_t, const scs_u32_t, const scs_value_t* const value, const scs_context_t context) {
    if (dadosCompartilhados && value) { *static_cast<bool*>(context) = (value->value_bool.value != 0); }
}
SCSAPI_VOID callback_generico_u32(const scs_string_t, const scs_u32_t, const scs_value_t* const value, const scs_context_t context) {
    if (dadosCompartilhados && value) { *static_cast<unsigned int*>(context) = value->value_u32.value; }
}
SCSAPI_VOID callback_generico_dplacement(const scs_string_t, const scs_u32_t, const scs_value_t* const value, const scs_context_t context) {
    if (dadosCompartilhados && value) {
        dplacement* destino = static_cast<dplacement*>(context);
        const scs_value_dplacement_t* origem = &(value->value_dplacement);
        *destino = *((dplacement*)origem); // Cópia direta
    }
}
SCSAPI_VOID callback_pause_play(const scs_event_t event, const void*, const scs_context_t) {
    if (dadosCompartilhados) { dadosCompartilhados->jogoRodando = (event == SCS_TELEMETRY_EVENT_started); }
}

SCSAPI_RESULT scs_telemetry_init(const scs_u32_t version, const scs_telemetry_init_params_t* const params) {
    if (version != SCS_TELEMETRY_VERSION_1_01) return SCS_RESULT_unsupported;
    const auto* const version_params = static_cast<const scs_telemetry_init_params_v101_t*>(params);

    hMapFile = CreateFileMappingW(INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE, 0, sizeof(TelemetriaCompleta), NOME_MEMORIA_COMPARTILHADA);
    if (hMapFile == NULL) return SCS_RESULT_generic_error;

    dadosCompartilhados = static_cast<TelemetriaCompleta*>(MapViewOfFile(hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, sizeof(TelemetriaCompleta)));
    if (dadosCompartilhados == nullptr) {
        CloseHandle(hMapFile);
        return SCS_RESULT_generic_error;
    }
    memset(dadosCompartilhados, 0, sizeof(TelemetriaCompleta));

    version_params->register_for_event(SCS_TELEMETRY_EVENT_paused, callback_pause_play, nullptr);
    version_params->register_for_event(SCS_TELEMETRY_EVENT_started, callback_pause_play, nullptr);

#define REGISTRAR_CANAL(nome, tipo, campo) version_params->register_for_channel(nome, SCS_U32_NIL, SCS_VALUE_TYPE_##tipo, SCS_TELEMETRY_CHANNEL_FLAG_no_value, callback_generico_##tipo, &dadosCompartilhados->campo)

    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_electric_enabled, bool, electricoLigado); // *** NOVO CANAL ***

    // ... (todos os outros REGISTRAR_CANAL continuam os mesmos)
    REGISTRAR_CANAL(SCS_TELEMETRY_TRAILER_CHANNEL_connected, bool, reboqueConectado);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_odometer, float, odometro);
    REGISTRAR_CANAL(SCS_TELEMETRY_CHANNEL_local_scale, float, escalaDoJogo);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_engine_enabled, bool, motorLigado);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_speed, float, velocidade);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_engine_rpm, float, rpm);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_engine_gear, s32, marcha);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_displayed_gear, s32, marchaPainel);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_fuel, float, combustivel);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_fuel_range, float, fuelRange);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_water_temperature, float, tempAgua);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_oil_pressure, float, pressaoOleo);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_oil_temperature, float, tempOleo);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_battery_voltage, float, voltagemBateria);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_adblue, float, nivelAdBlue);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_effective_steering, float, volante);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_effective_throttle, float, acelerador);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_effective_brake, float, freio);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_motor_brake, bool, freioMotor);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_retarder_level, u32, retarder);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_parking_brake, bool, freioEstacionamento);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_differential_lock, bool, bloqueioDiferencial);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_cruise_control, float, velocidadeCruzeiro);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_parking, bool, luzesEstacionamento);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_low_beam, bool, farolBaixo);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_high_beam, bool, farolAlto);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_lblinker, bool, piscaEsquerdoLogico);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_rblinker, bool, piscaDireitoLogico);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_lblinker, bool, piscaEsquerdoOn);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_rblinker, bool, piscaDireitoOn);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_hazard_warning, bool, piscaAlerta);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_brake, bool, luzFreio);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_reverse, bool, luzRe);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_light_beacon, bool, luzGiroflex);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_brake_air_pressure_warning, bool, avisoPressaoAr);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_oil_pressure_warning, bool, avisoPressaoOleo);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_water_temperature_warning, bool, avisoTempAgua);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_battery_voltage_warning, bool, avisoVoltagemBateria);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_fuel_warning, bool, avisoCombustivel);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_adblue_warning, bool, avisoAdBlue);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_lift_axle, bool, eixoCaminhaoLevantado);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_trailer_lift_axle, bool, eixoReboqueLevantado);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_wear_engine, float, danoMotor);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_wear_transmission, float, danoTransmissao);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_wear_cabin, float, danoCabine);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_wear_chassis, float, danoChassi);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_wear_wheels, float, danoRodas);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRAILER_CHANNEL_wear_chassis, float, danoReboque);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRAILER_CHANNEL_cargo_damage, float, danoCarga);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_navigation_distance, float, navDistancia);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_navigation_time, float, navTempoEstimado);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_navigation_speed_limit, float, navLimiteVelocidade);
    REGISTRAR_CANAL(SCS_TELEMETRY_TRUCK_CHANNEL_world_placement, dplacement, truckPlacement);

#undef REGISTRAR_CANAL
    return SCS_RESULT_ok;
}

SCSAPI_VOID scs_telemetry_shutdown(void) {
    if (dadosCompartilhados != nullptr) UnmapViewOfFile(dadosCompartilhados);
    if (hMapFile != NULL) CloseHandle(hMapFile);
    dadosCompartilhados = nullptr;
    hMapFile = NULL;
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    return TRUE;
}
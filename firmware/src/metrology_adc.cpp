#include "metrology_adc.h"

#include <Arduino.h>
#include <esp_timer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
#include <math.h>

// =============================================================================
// CONFIGURACIÓN DEL MUESTREO
// =============================================================================
// true: potenciómetros de laboratorio | false: sensores AC reales.
// Se puede sobreescribir desde platformio.ini con -DUSE_POT_SIMULATION=0.
#ifndef USE_POT_SIMULATION
#define USE_POT_SIMULATION 1
#endif

// 64 muestras por ciclo a 60 Hz. Con 8 ciclos por ventana salen 512 muestras,
// unos 133 ms. A 50 Hz la misma ventana da 6,67 ciclos y el recorte por cruce
// por cero se queda con 6: el cálculo no necesita saber la frecuencia de red.
static const size_t SAMPLES_PER_WINDOW = 512;
static const float SAMPLE_RATE_HZ = 3840.0f;
static const int64_t SAMPLE_PERIOD_US = (int64_t)(1000000.0 / SAMPLE_RATE_HZ);

// Descanso entre ventanas, para que la tarea de control pueda avanzar.
static const uint32_t REST_MS = 100;

// -----------------------------------------------------------------------------
// CONSTANTES DE CALIBRACIÓN
// -----------------------------------------------------------------------------
// Antes vivían enterradas dentro de getCurrentRMS() y getVoltageAC(), mezcladas
// con el bucle de muestreo. Ahora están juntas, arriba, y son lo único que hay
// que tocar al calibrar.

// ACS712 de 20 A: 100 mV/A según hoja de datos. 1 mV -> 0,01 A. Este sí es
// derivable y no necesita banco.
static const float I_SCALE_A_PER_MV = 0.01f;

// ZMPT101B. Este NO es derivable: depende del potenciómetro de ganancia del
// módulo, que es un ajuste manual irrepetible. El valor de partida supone que
// 120 V RMS de entrada producen del orden de 350 mV RMS a la salida.
//
// CALIBRAR EN BANCO: aplicar una tensión conocida medida con un multímetro
// true-RMS y ajustar hasta que `vrms` coincida. Es exactamente el problema que
// desaparece con la PCB propia, donde la ganancia la fija una resistencia al
// 0,1 % en vez de un tornillo.
static const float V_SCALE_V_PER_MV = 0.34f;

// Alineación temporal de V respecto a I: se muestrean alternados, no a la vez.
// 1.0 es sin corrección. Se ajusta con una carga puramente resistiva hasta que
// el pf medido dé 1.000; el valor útil suele caer entre 1,0 y 2,0.
static const float PHASE_CAL = 1.0f;

static const float NOISE_FLOOR_V = 15.0f;
static const float NOISE_FLOOR_I = 0.08f;

#if USE_POT_SIMULATION
// En simulación los potenciómetros dan continua, no una onda: no hay cruces por
// cero que medir. En vez de esquivar el cálculo, se sintetiza una senoidal de
// 60 Hz con la amplitud que marcan los potenciómetros y se pasa por el MISMO
// cálculo que en producción. Así el banco ejercita la ruta completa, incluido
// el factor de potencia, en lugar de un atajo que no se parece a nada.
static const float SIM_FREQ_HZ = 60.0f;
static const float SIM_PHASE_DEG = 25.0f; // pf esperado ~0.906
static const float SIM_V_FULL_SCALE = 140.0f;
static const float SIM_I_FULL_SCALE = 30.0f;
#endif

// -----------------------------------------------------------------------------
// ESTADO DEL MÓDULO
// -----------------------------------------------------------------------------
static float s_bufV[SAMPLES_PER_WINDOW];
static float s_bufI[SAMPLES_PER_WINDOW];

static MeteringResult s_latest;
static uint32_t s_latestMillis = 0;
static bool s_hasResult = false;
static uint32_t s_discarded = 0;
static SemaphoreHandle_t s_mutex = nullptr;

static int s_pinV = -1;
static int s_pinI = -1;
static MeteringCalib s_calib;

// -----------------------------------------------------------------------------
// ADQUISICIÓN
// -----------------------------------------------------------------------------
#if USE_POT_SIMULATION
static void fillWindow() {
  // Los potenciómetros fijan las amplitudes; la onda se genera aquí.
  const float vRms = (analogRead(s_pinV) / 4095.0f) * SIM_V_FULL_SCALE;
  const float iRms = (analogRead(s_pinI) / 4095.0f) * SIM_I_FULL_SCALE;

  const float vAmp = vRms * 1.41421356f;
  const float iAmp = iRms * 1.41421356f;
  const float phi = SIM_PHASE_DEG * 3.14159265f / 180.0f;
  const float w = 2.0f * 3.14159265f * SIM_FREQ_HZ / SAMPLE_RATE_HZ;

  for (size_t k = 0; k < SAMPLES_PER_WINDOW; k++) {
    const float a = w * (float)k;
    s_bufV[k] = vAmp * sinf(a);
    s_bufI[k] = iAmp * sinf(a - phi);
  }
  // La senoidal sintética ya está en voltios y amperios.
  s_calib.vScale = 1.0f;
  s_calib.iScale = 1.0f;
}
#else
static void fillWindow() {
  // Muestreo alternado V, I a cadencia fija. El instante objetivo de cada
  // muestra se calcula en absoluto con esp_timer_get_time(), de modo que el
  // tiempo variable que tarda analogReadMilliVolts() no se acumula como deriva.
  //
  // analogReadMilliVolts() en lugar de analogRead(): aplica la curva de
  // calibración grabada en la eFuse del chip. El ADC del ESP32 tiene una no
  // linealidad importante en los extremos del rango y la lectura cruda no la
  // corrige.
  int64_t next = esp_timer_get_time();
  for (size_t k = 0; k < SAMPLES_PER_WINDOW; k++) {
    while (esp_timer_get_time() < next) {
      // Espera corta hasta el instante objetivo.
    }
    next += SAMPLE_PERIOD_US;
    s_bufV[k] = (float)analogReadMilliVolts(s_pinV);
    s_bufI[k] = (float)analogReadMilliVolts(s_pinI);
  }
  s_calib.vScale = V_SCALE_V_PER_MV;
  s_calib.iScale = I_SCALE_A_PER_MV;
}
#endif

static void vMeteringTask(void* pvParameters) {
  (void)pvParameters;
  for (;;) {
    fillWindow();

    const MeteringResult r =
        computeMetering(s_bufV, s_bufI, SAMPLES_PER_WINDOW, s_calib);

    if (r.valid) {
      if (xSemaphoreTake(s_mutex, pdMS_TO_TICKS(50)) == pdTRUE) {
        s_latest = r;
        s_latestMillis = millis();
        s_hasResult = true;
        xSemaphoreGive(s_mutex);
      }
    } else {
      // Sin cruces por cero: o no hay red, o la escala de tensión está mal.
      s_discarded++;
    }

    vTaskDelay(pdMS_TO_TICKS(REST_MS));
  }
}

// -----------------------------------------------------------------------------
// API PÚBLICA
// -----------------------------------------------------------------------------
bool metrologyBegin(int pinVoltaje, int pinCorriente) {
  s_pinV = pinVoltaje;
  s_pinI = pinCorriente;

  s_calib.vScale = V_SCALE_V_PER_MV;
  s_calib.iScale = I_SCALE_A_PER_MV;
  s_calib.phaseCal = PHASE_CAL;
  s_calib.sampleRateHz = SAMPLE_RATE_HZ;
  s_calib.noiseFloorV = NOISE_FLOOR_V;
  s_calib.noiseFloorI = NOISE_FLOOR_I;

  s_mutex = xSemaphoreCreateMutex();
  if (s_mutex == nullptr) return false;

  // Prioridad 3, por encima del control: ver la nota en metrology_adc.h.
  // Anclada al Core 1 para no competir con la pila WiFi, que vive en el Core 0.
  const BaseType_t ok = xTaskCreatePinnedToCore(
      vMeteringTask, "MeteringTask", 4096, nullptr, 3, nullptr, 1);
  return ok == pdPASS;
}

bool metrologyGetLatest(MeteringResult& out, uint32_t& ageMs) {
  if (s_mutex == nullptr) return false;
  if (xSemaphoreTake(s_mutex, pdMS_TO_TICKS(20)) != pdTRUE) return false;

  const bool have = s_hasResult;
  if (have) {
    out = s_latest;
    ageMs = millis() - s_latestMillis;
  }
  xSemaphoreGive(s_mutex);
  return have;
}

uint32_t metrologyDiscardedWindows() {
  return s_discarded;
}

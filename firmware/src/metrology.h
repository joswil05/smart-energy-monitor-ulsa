#pragma once

#include <stddef.h>

// =============================================================================
// METROLOGÍA: CÁLCULO PURO
// =============================================================================
// Este encabezado no depende de Arduino ni del ESP32 a propósito. El cálculo es
// aritmética sobre dos vectores de muestras, así que puede compilarse y
// probarse en el ordenador (ver firmware/test/test_metrology/). El muestreo,
// que sí es específico del hardware, vive aparte en metrology_adc.cpp.
//
// Lo que arregla frente a la versión anterior del firmware:
//
//   1. `p = v_rms * i_rms` era potencia APARENTE (VA). La activa (W) exige
//      integrar el producto instantáneo v[n]*i[n]. Sin eso no existe factor de
//      potencia, y por eso el firmware publicaba un `pf` fijo de 0.98.
//   2. La ventana era de 2,38 ciclos de red. Una ventana que no es un número
//      entero de ciclos produce error de scalloping: el RMS oscila despacio
//      aunque la señal sea perfectamente estable. Aquí la ventana se recorta
//      entre el primer y el último cruce por cero ascendente.
//   3. El offset de continua estaba codificado como constante (`zero_point`).
//      Ahora se calcula como la media de la propia ventana, que para un número
//      entero de ciclos es exactamente el offset. Sin deriva térmica ni
//      dependencia de la placa concreta.

struct MeteringResult {
  float vrms;          // voltios
  float irms;          // amperios
  float p;             // vatios, potencia ACTIVA
  float q;             // var, reactiva con signo (+ inductiva, - capacitiva)
  float s;             // VA, aparente
  float pf;            // -1 a 1, con signo
  float freq;          // Hz de la red
  float windowSeconds; // duración exacta de la ventana integrada
  unsigned cycles;     // ciclos completos de red dentro de la ventana
  bool valid;          // false si no hubo cruces suficientes para medir
};

struct MeteringCalib {
  float vScale;       // cuentas del ADC -> voltios
  float iScale;       // cuentas del ADC -> amperios
  // Alineación temporal de V respecto a I. V e I no se muestrean a la vez sino
  // alternados, así que I va medio periodo de muestreo por detrás. 1.0 es "sin
  // corrección"; 1.5 extrapola media muestra hacia adelante. Se ajusta en banco
  // contra una carga puramente resistiva hasta que el pf medido dé 1.000.
  float phaseCal;
  float sampleRateHz; // muestras por segundo y por canal
  float noiseFloorV;  // por debajo de esta tensión se considera red ausente
  float noiseFloorI;  // por debajo de esta corriente se considera sin carga
};

// Integra una ventana de muestras crudas y devuelve las magnitudes eléctricas.
// `vRaw` e `iRaw` deben tener `n` elementos y corresponder al mismo intervalo.
MeteringResult computeMetering(const float* vRaw, const float* iRaw, size_t n,
                               const MeteringCalib& cal);

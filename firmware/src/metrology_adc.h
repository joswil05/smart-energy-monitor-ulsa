#pragma once

#include <stdint.h>

#include "metrology.h"

// =============================================================================
// MUESTREO: LA MITAD QUE SÍ DEPENDE DEL HARDWARE
// =============================================================================
// El cálculo vive en metrology.cpp y no sabe nada del ESP32. Aquí está lo otro:
// la adquisición periódica de muestras y la tarea que la ejecuta.
//
// Por qué es una tarea aparte y no parte de vControlTask, como antes:
//
//   El muestreo anterior gastaba 79 ms de cada ciclo de 100 ms en
//   `delayMicroseconds`, que es espera activa y no cede el planificador. Es
//   decir, la tarea de control pasaba el 79% de su tiempo sin hacer nada,
//   bloqueando de paso a todo lo demás de prioridad igual o menor en el Core 1.
//
//   Ahora el muestreo tiene su propia tarea. La consecuencia importante no es
//   de rendimiento sino de exactitud: la cadencia del bucle de control deja de
//   influir en la medida. Antes, el jitter del planificador entraba
//   directamente en `deltaTime` y por tanto en la integración de energía.
//
// Limitación conocida: la tarea de muestreo corre por encima del control, así
// que durante cada ráfaga (unos 133 ms) el control queda desalojado. Se acepta
// porque el control no es de tiempo real duro y porque su cadencia ya no afecta
// a la medida. La solución definitiva es el driver `adc_continuous` por DMA,
// que además queda sin objeto en cuanto entre el ADE7953 de la PCB propia.

// Arranca el muestreo. Debe llamarse una sola vez, desde setup().
bool metrologyBegin(int pinVoltaje, int pinCorriente);

// Copia la última medida completa. Devuelve false si todavía no hay ninguna.
// `ageMs` recibe los milisegundos transcurridos desde que se calculó, para que
// quien la consuma pueda descartarla si el muestreo se ha detenido.
bool metrologyGetLatest(MeteringResult& out, uint32_t& ageMs);

// Número de ventanas descartadas por no encontrar cruces por cero suficientes.
// Se publica en telemetría de salud: si crece, o no hay red o la calibración
// de tensión está mal.
uint32_t metrologyDiscardedWindows();

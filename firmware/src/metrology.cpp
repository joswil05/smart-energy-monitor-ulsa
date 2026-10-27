#include "metrology.h"

#include <math.h>

static MeteringResult emptyResult() {
  MeteringResult r;
  r.vrms = 0.0f;
  r.irms = 0.0f;
  r.p = 0.0f;
  r.q = 0.0f;
  r.s = 0.0f;
  r.pf = 0.0f;
  r.freq = 0.0f;
  r.windowSeconds = 0.0f;
  r.cycles = 0;
  r.valid = false;
  return r;
}

MeteringResult computeMetering(const float* vRaw, const float* iRaw, size_t n,
                               const MeteringCalib& cal) {
  MeteringResult r = emptyResult();
  if (vRaw == nullptr || iRaw == nullptr || n < 16 || cal.sampleRateHz <= 0.0f) {
    return r;
  }

  // 1. Media de la ventana completa. Solo sirve para poder localizar los cruces
  //    por cero; el valor definitivo se recalcula luego sobre la ventana ya
  //    recortada, donde es exacto.
  double meanV = 0.0;
  for (size_t k = 0; k < n; k++) meanV += (double)vRaw[k];
  meanV /= (double)n;

  // 2. Cruces por cero ascendentes de la tensión. Se integra solo entre el
  //    primero y el último, de modo que la ventana contiene un número ENTERO
  //    de ciclos de red.
  size_t first = 0, last = 0;
  unsigned crossings = 0;
  for (size_t k = 1; k < n; k++) {
    const double prev = (double)vRaw[k - 1] - meanV;
    const double cur = (double)vRaw[k] - meanV;
    if (prev <= 0.0 && cur > 0.0) {
      if (crossings == 0) first = k;
      last = k;
      crossings++;
    }
  }
  if (crossings < 2) return r; // Sin red, o ventana más corta que un ciclo.

  const size_t m = last - first;
  const unsigned cycles = crossings - 1;
  if (m < 8) return r;

  // 3. Offset de continua exacto sobre la ventana de ciclos enteros.
  double dcV = 0.0, dcI = 0.0;
  for (size_t k = first; k < last; k++) {
    dcV += (double)vRaw[k];
    dcI += (double)iRaw[k];
  }
  dcV /= (double)m;
  dcI /= (double)m;

  const double samplesPerCycle = (double)m / (double)cycles;
  // Desfase de un cuarto de ciclo para la componente reactiva. Al integrarse
  // sobre ciclos enteros, el índice puede dar la vuelta dentro de la ventana:
  // la señal es periódica en ese intervalo, así que es exacto.
  const size_t quarter = (size_t)(samplesPerCycle / 4.0 + 0.5);

  // Tensión con la media quitada y alineada temporalmente con la corriente.
  // Índice circular en [0, m).
  struct AlignedV {
    const float* raw;
    size_t first;
    size_t m;
    double dc;
    double phaseCal;
    double at(size_t idx) const {
      const double b = (double)raw[first + idx] - dc;
      const double a = (double)raw[first + ((idx + m - 1) % m)] - dc;
      return a + phaseCal * (b - a);
    }
  };
  const AlignedV vw{vRaw, first, m, dcV, (double)cal.phaseCal};

  double sumV2 = 0.0, sumI2 = 0.0, sumP = 0.0, sumQ = 0.0;
  for (size_t idx = 0; idx < m; idx++) {
    const double v = vw.at(idx);
    const double i = (double)iRaw[first + idx] - dcI;
    const double vq = vw.at((idx + m - quarter) % m);

    sumV2 += v * v;
    sumI2 += i * i;
    sumP += v * i;   // potencia activa
    sumQ += vq * i;  // potencia reactiva, V desfasada un cuarto de ciclo
  }

  const double inv = 1.0 / (double)m;
  const double vs = (double)cal.vScale;
  const double is = (double)cal.iScale;

  r.vrms = (float)(vs * sqrt(sumV2 * inv));
  r.irms = (float)(is * sqrt(sumI2 * inv));
  r.p = (float)(vs * is * sumP * inv);
  r.q = (float)(vs * is * sumQ * inv);
  r.freq = (float)(cal.sampleRateHz / samplesPerCycle);
  r.windowSeconds = (float)((double)m / (double)cal.sampleRateHz);
  r.cycles = cycles;
  r.valid = true;

  // 4. Umbrales de ruido. Sin red no hay nada que medir; con red pero sin carga
  //    se conserva la tensión y la frecuencia, que siguen siendo válidas.
  if (r.vrms < cal.noiseFloorV) {
    const float freq = r.freq;
    const float win = r.windowSeconds;
    const unsigned cyc = r.cycles;
    r = emptyResult();
    r.freq = freq;
    r.windowSeconds = win;
    r.cycles = cyc;
    r.valid = true;
    return r;
  }
  if (r.irms < cal.noiseFloorI) {
    r.irms = 0.0f;
    r.p = 0.0f;
    r.q = 0.0f;
    r.s = 0.0f;
    r.pf = 0.0f;
    return r;
  }

  r.s = r.vrms * r.irms;
  r.pf = (r.s > 0.0f) ? (r.p / r.s) : 0.0f;
  if (r.pf > 1.0f) r.pf = 1.0f;
  if (r.pf < -1.0f) r.pf = -1.0f;
  return r;
}

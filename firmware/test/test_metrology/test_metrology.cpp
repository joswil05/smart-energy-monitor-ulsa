// Pruebas del cálculo de metrología (firmware/src/metrology.cpp).
//
// Sin dependencias externas: el cálculo es aritmética pura, así que se compila
// y se ejecuta en el ordenador contra formas de onda sintéticas de factor de
// potencia conocido. Es la única manera de comprobar que el algoritmo es
// correcto sin tener el hardware delante.
//
//   Windows (Visual Studio Build Tools, desde este directorio):
//     cl /EHsc /O2 /I..\..\src test_metrology.cpp ..\..\src\metrology.cpp
//   Linux / macOS:
//     g++ -O2 -I../../src test_metrology.cpp ../../src/metrology.cpp -o t && ./t

#include "metrology.h"

#include <cmath>
#include <cstdio>
#include <vector>

static int fallos = 0;
static int total = 0;

static void check(bool ok, const char* nombre, const char* detalle = "") {
  total++;
  if (ok) {
    std::printf("  ok    %s %s\n", nombre, detalle);
  } else {
    fallos++;
    std::printf("  FALLO %s %s\n", nombre, detalle);
  }
}

static void checkNear(double obtenido, double esperado, double tolRel,
                      const char* nombre) {
  const double margen = std::fabs(esperado) * tolRel;
  const bool ok =
      std::fabs(obtenido - esperado) <= (margen > 1e-9 ? margen : 1e-6);
  char detalle[128];
  std::snprintf(detalle, sizeof(detalle), "(obtenido %.4f, esperado %.4f)",
                obtenido, esperado);
  check(ok, nombre, detalle);
}

static const double PI = 3.14159265358979323846;

// Genera una ventana de muestras. phaseDeg > 0 es carga inductiva: la corriente
// va retrasada respecto a la tensión.
static void generar(std::vector<float>& v, std::vector<float>& i, size_t n,
                    double fs, double f0, double vRms, double iRms,
                    double phaseDeg, double vDC = 0.0, double iDC = 0.0) {
  v.resize(n);
  i.resize(n);
  const double vAmp = vRms * std::sqrt(2.0);
  const double iAmp = iRms * std::sqrt(2.0);
  const double phi = phaseDeg * PI / 180.0;
  for (size_t k = 0; k < n; k++) {
    const double t = (double)k / fs;
    const double w = 2.0 * PI * f0 * t;
    v[k] = (float)(vDC + vAmp * std::sin(w));
    i[k] = (float)(iDC + iAmp * std::sin(w - phi));
  }
}

static MeteringCalib calibBase(double fs = 3840.0) {
  MeteringCalib c;
  c.vScale = 1.0f;    // las muestras sintéticas ya vienen en voltios
  c.iScale = 1.0f;    // y en amperios
  c.phaseCal = 1.0f;  // sin corrección: la generación ya está alineada
  c.sampleRateHz = (float)fs;
  c.noiseFloorV = 5.0f;
  c.noiseFloorI = 0.02f;
  return c;
}

// -----------------------------------------------------------------------------

static void testResistiva() {
  std::printf("\n[1] Carga puramente resistiva, 120 V / 10 A a 60 Hz\n");
  std::vector<float> v, i;
  generar(v, i, 640, 3840.0, 60.0, 120.0, 10.0, 0.0);  // 10 ciclos exactos
  const MeteringResult r =
      computeMetering(v.data(), i.data(), v.size(), calibBase());

  check(r.valid, "resultado valido");
  checkNear(r.vrms, 120.0, 0.005, "vrms");
  checkNear(r.irms, 10.0, 0.005, "irms");
  checkNear(r.p, 1200.0, 0.005, "p (activa)");
  checkNear(r.s, 1200.0, 0.005, "s (aparente)");
  checkNear(r.pf, 1.0, 0.005, "pf");
  check(std::fabs(r.q) < 15.0, "q proxima a cero");
  checkNear(r.freq, 60.0, 0.01, "frecuencia");
}

static void testInductiva() {
  std::printf("\n[2] Carga inductiva, desfase 60 grados (pf esperado 0.5)\n");
  std::vector<float> v, i;
  generar(v, i, 640, 3840.0, 60.0, 120.0, 10.0, 60.0);
  const MeteringResult r =
      computeMetering(v.data(), i.data(), v.size(), calibBase());

  checkNear(r.pf, 0.5, 0.02, "pf");
  checkNear(r.p, 600.0, 0.02, "p (activa)");
  checkNear(r.s, 1200.0, 0.01, "s (aparente)");
  checkNear(r.q, 1039.23, 0.02, "q (reactiva, positiva)");
  check(r.q > 0.0f, "signo de q es inductivo");
  // Esta es la comprobacion que el firmware anterior no podia superar: al
  // calcular p = vrms * irms daba 1200 W en vez de 600 W, un 100% de error.
  check(std::fabs(r.p - r.s) > 500.0f, "p y s difieren de verdad");
}

static void testCapacitiva() {
  std::printf("\n[3] Carga capacitiva, desfase -60 grados\n");
  std::vector<float> v, i;
  generar(v, i, 640, 3840.0, 60.0, 120.0, 10.0, -60.0);
  const MeteringResult r =
      computeMetering(v.data(), i.data(), v.size(), calibBase());

  checkNear(r.pf, 0.5, 0.02, "pf");
  checkNear(r.q, -1039.23, 0.02, "q (reactiva, negativa)");
  check(r.q < 0.0f, "signo de q es capacitivo");
}

static void testOffsetContinua() {
  std::printf("\n[4] Rechazo del offset de continua\n");
  std::vector<float> v, i;
  // Offsets grandes y distintos en cada canal, como los reales del ZMPT y del
  // ACS712. La version anterior los absorbia en constantes escritas a mano.
  generar(v, i, 640, 3840.0, 60.0, 120.0, 10.0, 0.0, 1650.0, 1880.0);
  const MeteringResult r =
      computeMetering(v.data(), i.data(), v.size(), calibBase());

  checkNear(r.vrms, 120.0, 0.005, "vrms con offset de 1650");
  checkNear(r.irms, 10.0, 0.005, "irms con offset de 1880");
  checkNear(r.pf, 1.0, 0.005, "pf con offset");
}

static void testVentanaNoEntera() {
  std::printf("\n[5] Ventana que no es multiplo de un ciclo (6.25 ciclos)\n");
  std::vector<float> v, i;
  generar(v, i, 400, 3840.0, 60.0, 120.0, 10.0, 0.0);
  const MeteringResult r =
      computeMetering(v.data(), i.data(), v.size(), calibBase());

  check(r.cycles == 6, "recorta a 6 ciclos enteros");
  checkNear(r.vrms, 120.0, 0.005, "vrms sigue exacta");
  checkNear(r.p, 1200.0, 0.005, "p sigue exacta");
}

static void testSinScalloping() {
  std::printf("\n[6] Estabilidad frente a la longitud de ventana (scalloping)\n");
  // El fallo original: la ventana era de 2.38 ciclos, asi que la lectura RMS
  // oscilaba despacio aunque la senal fuese perfectamente estable. Con el
  // recorte por cruce por cero, la longitud del buffer deja de importar.
  const size_t longitudes[] = {300, 337, 400, 461, 512, 613};
  double minV = 1e9, maxV = -1e9;
  for (size_t idx = 0; idx < 6; idx++) {
    std::vector<float> v, i;
    generar(v, i, longitudes[idx], 3840.0, 60.0, 120.0, 10.0, 0.0);
    const MeteringResult r =
        computeMetering(v.data(), i.data(), v.size(), calibBase());
    if (r.vrms < minV) minV = r.vrms;
    if (r.vrms > maxV) maxV = r.vrms;
  }
  const double dispersion = (maxV - minV) / 120.0;
  char detalle[128];
  std::snprintf(detalle, sizeof(detalle),
                "(dispersion %.4f%% entre 6 longitudes de buffer)",
                dispersion * 100.0);
  check(dispersion < 0.002, "vrms estable", detalle);
}

static void testFrecuencia50Hz() {
  std::printf("\n[7] Deteccion de frecuencia a 50 Hz\n");
  std::vector<float> v, i;
  generar(v, i, 1536, 3840.0, 50.0, 230.0, 5.0, 0.0);  // 20 ciclos
  const MeteringResult r =
      computeMetering(v.data(), i.data(), v.size(), calibBase());

  checkNear(r.freq, 50.0, 0.015, "frecuencia");
  checkNear(r.vrms, 230.0, 0.01, "vrms a 230 V");
}

static void testUmbralesDeRuido() {
  std::printf("\n[8] Umbrales de ruido\n");
  std::vector<float> v, i;

  // Red presente y sin carga: la tension sigue siendo una medida valida.
  generar(v, i, 640, 3840.0, 60.0, 120.0, 0.001, 0.0);
  MeteringResult r = computeMetering(v.data(), i.data(), v.size(), calibBase());
  checkNear(r.vrms, 120.0, 0.005, "vrms con red y sin carga");
  check(r.irms == 0.0f && r.p == 0.0f, "corriente y potencia a cero sin carga");

  // Sin red: no hay nada que medir.
  generar(v, i, 640, 3840.0, 60.0, 1.0, 10.0, 0.0);
  r = computeMetering(v.data(), i.data(), v.size(), calibBase());
  check(r.vrms == 0.0f && r.p == 0.0f, "todo a cero sin red");
}

static void testEntradasDegeneradas() {
  std::printf("\n[9] Entradas degeneradas\n");
  std::vector<float> v(640, 0.0f), i(640, 0.0f);
  MeteringResult r = computeMetering(v.data(), i.data(), v.size(), calibBase());
  check(!r.valid, "senal plana no produce medida valida");

  r = computeMetering(nullptr, nullptr, 640, calibBase());
  check(!r.valid, "punteros nulos no revientan");

  generar(v, i, 640, 3840.0, 60.0, 120.0, 10.0, 0.0);
  r = computeMetering(v.data(), i.data(), 8, calibBase());
  check(!r.valid, "ventana mas corta que un ciclo no produce medida");
}

int main() {
  std::printf("=== Pruebas del calculo de metrologia ===\n");
  testResistiva();
  testInductiva();
  testCapacitiva();
  testOffsetContinua();
  testVentanaNoEntera();
  testSinScalloping();
  testFrecuencia50Hz();
  testUmbralesDeRuido();
  testEntradasDegeneradas();

  std::printf("\n=== %d de %d comprobaciones superadas ===\n", total - fallos,
              total);
  return fallos == 0 ? 0 : 1;
}

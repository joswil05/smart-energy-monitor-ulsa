#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_task_wdt.h>

#include "metrology_adc.h"
#include <sys/time.h>
#include <time.h>

// Inclusión de secretos de red y cloud.
// Cada define se protege por separado para que un secrets.h antiguo, sin las
// claves de autenticación añadidas en la Fase 0, siga compilando.
#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID "TU_RED_WIFI"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "TU_CONTRASENA_WIFI"
#endif
#ifndef FIREBASE_API_KEY
#define FIREBASE_API_KEY "TU_API_KEY"
#endif
#ifndef FIREBASE_DATABASE_URL
#define FIREBASE_DATABASE_URL "tu-proyecto.firebaseio.com"
#endif
// Cuenta de servicio del dispositivo. Ver firebase/README.md, paso 1.
#ifndef FIREBASE_USER_EMAIL
#define FIREBASE_USER_EMAIL "device@smart-energy-ulsa.local"
#endif
#ifndef FIREBASE_USER_PASSWORD
#define FIREBASE_USER_PASSWORD "CAMBIAR_EN_SECRETS_H"
#endif

#define FW_VERSION "1.1.0"

// =============================================================================
// CONFIGURACIÓN DE HARDWARE Y PARÁMETROS
// =============================================================================
// El interruptor USE_POT_SIMULATION y las constantes de calibración viven
// ahora en metrology_adc.cpp, junto al muestreo al que pertenecen.

// Nivel lógico que cierra el relé. Los módulos de 4 canales optoacoplados más
// comunes son ACTIVO-BAJO: si el tuyo lo es, poner LOW aquí y nada más.
// Verificar en banco antes de conectar cargas reales.
#define RELAY_ACTIVE_LEVEL HIGH
#define RELAY_IDLE_LEVEL ((RELAY_ACTIVE_LEVEL) == HIGH ? LOW : HIGH)

// Pines de actuadores y sensores.
// El relé 3 salió de GPIO 14: ese pin es MTMS/HSPI-CLK y el bootloader lo agita
// durante el arranque, lo que hacía chasquear el relé en cada reinicio.
const int PINES_RELES[] = {4, 16, 17, 27};
const int PIN_PIR = 26;
const int PIN_VOLTAJE = 35;   // ZMPT101B (ADC1_CH7)
const int PIN_CORRIENTE = 34; // SCT-013 / ACS712 (ADC1_CH6)

// Configuración pantalla OLED I2C
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET_PIN -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);

// Cadencias del sistema
static const uint32_t CONTROL_PERIOD_MS = 100;
static const uint32_t CLOUD_PERIOD_MS = 100;
static const uint32_t METRICS_PERIOD_MS = 2000;
static const uint32_t CONFIG_POLL_MS = 1500;
static const uint32_t HEALTH_PERIOD_MS = 30000;
static const uint32_t WIFI_RETRY_MS = 30000;
static const uint32_t CLOUD_STALL_MS = 180000;
// Si la última medida es más vieja que esto, se trata el sistema como si
// no midiera: mejor publicar cero que arrastrar un valor congelado.
static const uint32_t METERING_MAX_AGE_MS = 3000;

// Persistencia: guardar con delta >= 0.01 kWh, o tras 15 minutos CON cambio.
static const uint64_t NVS_MIN_DELTA_UWH = 10000000ULL; // 0.01 kWh
static const uint32_t NVS_MAX_INTERVAL_MS = 900000;

// =============================================================================
// MODELO DE ESTADO Y COMUNICACIÓN INTER-CORE (FreeRTOS)
// =============================================================================
enum class SystemMode : uint8_t {
  NORMAL = 0,
  ECO,
  NIGHT,
  AWAY
};

const char* modeToString(SystemMode mode) {
  switch (mode) {
    case SystemMode::ECO:    return "eco";
    case SystemMode::NIGHT:  return "night";
    case SystemMode::AWAY:   return "away";
    default:                 return "normal";
  }
}

SystemMode stringToMode(const String& str) {
  if (str.equalsIgnoreCase("eco"))   return SystemMode::ECO;
  if (str.equalsIgnoreCase("night")) return SystemMode::NIGHT;
  if (str.equalsIgnoreCase("away"))  return SystemMode::AWAY;
  return SystemMode::NORMAL;
}

// Estructura de estado global compartido.
// SOLO se toca con el mutex tomado, vía lockState() / unlockState().
struct SystemState {
  float voltageRMS = 0.0f;
  float currentRMS = 0.0f;
  float powerWatts = 0.0f;   // ACTIVA (W), ya no aparente
  float reactiveVar = 0.0f;  // reactiva con signo (var)
  float apparentVA = 0.0f;   // aparente (VA)
  float powerFactor = 0.0f;  // medido, ya no el literal 0.98
  float lineFreq = 0.0f;     // Hz
  // Energía en microvatios-hora, entero de 64 bits.
  // El float de 32 bits anterior congelaba el contador: a 562 kWh acumulados
  // medio ULP son 3.05e-5 kWh y el incremento a 190 W es 5.28e-6 kWh, así que
  // cada suma redondeaba de vuelta al mismo número. Un uint64 en uWh es exacto
  // y cubre 1.8e13 kWh.
  uint64_t energyMicroWh = 0;
  SystemMode mode = SystemMode::NORMAL;
  bool relayStates[4] = {false, false, false, false};
  bool intruderAlert = false;
  bool pirActive = false;
  bool wifiConnected = false;
  bool cloudReady = false;
  uint32_t queueDrops = 0;
  uint32_t lockFailures = 0;
};

// Eventos de control hacia la nube (Core 1 -> Core 0)
enum class CloudEventType : uint8_t {
  RELAY_SYNC,
  INTRUDER_ALERT
};

struct CloudEvent {
  CloudEventType type;
  uint8_t deviceIndex; // 1 a 4
  bool state;
};

// Órdenes de relé desde la nube hacia control (Core 0 -> Core 1).
// Core 0 ya no toca GPIO: hay una única fuente de verdad, applyRelay().
struct RelayCommand {
  uint8_t index; // 0 a 3
  bool state;
};

// Primitivas de sincronización FreeRTOS
static SemaphoreHandle_t xStateMutex = NULL;
static QueueHandle_t xCloudEventQueue = NULL;
static QueueHandle_t xRelayCommandQueue = NULL;
static SystemState g_systemState;

// Watchdog software de la tarea de red. La tarea de nube hace llamadas TLS
// bloqueantes que pueden superar el timeout del TWDT hardware, así que en vez
// de registrarla en el TWDT publica un latido que vigila la tarea de control.
static volatile uint32_t g_cloudHeartbeat = 0;

// Servicios y objetos globales
FirebaseData fbdo;
FirebaseData fbdoStream;
FirebaseAuth auth;
FirebaseConfig config;
Preferences preferences;

// =============================================================================
// ACCESO AL ESTADO COMPARTIDO
// =============================================================================
static inline bool lockState(uint32_t ms) {
  return xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(ms)) == pdTRUE;
}

static inline void unlockState() {
  xSemaphoreGive(xStateMutex);
}

static void countQueueDrop() {
  if (lockState(20)) {
    g_systemState.queueDrops++;
    unlockState();
  }
}

static void countLockFailure() {
  // Sin mutex a propósito: es un contador de diagnóstico y el mutex es
  // justamente lo que ha fallado. Una carrera aquí solo pierde una cuenta.
  g_systemState.lockFailures++;
}

// =============================================================================
// PERSISTENCIA NVS CON DOBLE COPIA Y CRC
// =============================================================================
static const uint32_t ENERGY_MAGIC = 0x53454D55; // 'SEMU'

struct __attribute__((packed)) EnergyRecord {
  uint32_t magic;
  uint32_t seq;
  uint64_t microWh;
  uint32_t crc;
};

static uint32_t g_energySeq = 0;
static uint8_t g_energySlot = 0; // 0 -> escribir en "eA", 1 -> escribir en "eB"

static uint32_t crc32Buffer(const uint8_t* data, size_t len) {
  uint32_t crc = 0xFFFFFFFFu;
  while (len--) {
    crc ^= *data++;
    for (int k = 0; k < 8; k++) {
      crc = (crc >> 1) ^ (0xEDB88320u & (~(crc & 1u) + 1u));
    }
  }
  return ~crc;
}

static bool readEnergySlot(const char* key, EnergyRecord& out) {
  if (preferences.getBytesLength(key) != sizeof(EnergyRecord)) return false;
  if (preferences.getBytes(key, &out, sizeof(out)) != sizeof(out)) return false;
  if (out.magic != ENERGY_MAGIC) return false;
  const uint32_t expected =
      crc32Buffer(reinterpret_cast<const uint8_t*>(&out),
                  sizeof(EnergyRecord) - sizeof(uint32_t));
  return expected == out.crc;
}

// Devuelve la energía acumulada en uWh y deja g_energySeq / g_energySlot listos.
static uint64_t loadEnergy() {
  EnergyRecord a{}, b{};
  const bool okA = readEnergySlot("eA", a);
  const bool okB = readEnergySlot("eB", b);

  if (okA && okB) {
    const bool aIsNewer = (a.seq >= b.seq);
    g_energySeq = aIsNewer ? a.seq : b.seq;
    g_energySlot = aIsNewer ? 1 : 0;
    return aIsNewer ? a.microWh : b.microWh;
  }
  if (okA) { g_energySeq = a.seq; g_energySlot = 1; return a.microWh; }
  if (okB) { g_energySeq = b.seq; g_energySlot = 0; return b.microWh; }

  // Migración desde el esquema anterior: float en kWh bajo la clave "total".
  const float legacy = preferences.getFloat("total", -1.0f);
  if (legacy >= 0.0f) {
    const uint64_t migrated = (uint64_t)((double)legacy * 1e9);
    Serial.printf("[NVS] Migrando esquema antiguo: %.4f kWh -> %llu uWh\n",
                  legacy, (unsigned long long)migrated);
    return migrated;
  }

  Serial.println("[NVS] Sin registro previo de energia. Arrancando en cero.");
  return 0;
}

static bool saveEnergy(uint64_t microWh) {
  EnergyRecord r{};
  r.magic = ENERGY_MAGIC;
  r.seq = g_energySeq + 1;
  r.microWh = microWh;
  r.crc = crc32Buffer(reinterpret_cast<const uint8_t*>(&r),
                      sizeof(EnergyRecord) - sizeof(uint32_t));

  const char* key = (g_energySlot == 0) ? "eA" : "eB";
  const size_t written = preferences.putBytes(key, &r, sizeof(r));
  if (written != sizeof(r)) {
    Serial.printf("[NVS] ERROR escribiendo '%s': %u de %u bytes\n",
                  key, (unsigned)written, (unsigned)sizeof(r));
    return false;
  }

  // Solo se avanza el turno si la escritura fue completa, de modo que la copia
  // buena de la ranura contraria sigue intacta ante un corte de energía.
  g_energySeq = r.seq;
  g_energySlot ^= 1;
  return true;
}

// =============================================================================
// ACTUACIÓN SOBRE RELÉS: FUENTE ÚNICA DE VERDAD
// =============================================================================
// Único punto del programa que escribe un GPIO de relé y su espejo en el
// estado. Debe invocarse SOLO desde vControlTask (Core 1). Core 0 encola en
// xRelayCommandQueue. Antes, ambos núcleos hacían digitalWrite() sin
// coordinación y Core 0 usaba digitalRead() como fuente de verdad paralela.
static void applyRelay(uint8_t index, bool on, bool notifyCloud) {
  if (index >= 4) return;

  digitalWrite(PINES_RELES[index], on ? RELAY_ACTIVE_LEVEL : RELAY_IDLE_LEVEL);

  if (lockState(50)) {
    g_systemState.relayStates[index] = on;
    unlockState();
  } else {
    countLockFailure();
    Serial.printf("[RELE] Aviso: espejo de estado no actualizado para R%u\n",
                  (unsigned)(index + 1));
  }

  if (notifyCloud) {
    CloudEvent evt{CloudEventType::RELAY_SYNC, (uint8_t)(index + 1), on};
    if (xQueueSend(xCloudEventQueue, &evt, 0) != pdTRUE) {
      countQueueDrop();
      Serial.printf("[COLA] Descartado RELAY_SYNC R%u=%d (cola llena)\n",
                    (unsigned)(index + 1), on ? 1 : 0);
    }
  }
}

static void raiseIntruderAlert(bool state) {
  CloudEvent evt{CloudEventType::INTRUDER_ALERT, 0, state};
  if (xQueueSend(xCloudEventQueue, &evt, 0) != pdTRUE) {
    countQueueDrop();
    Serial.println("[COLA] Descartado INTRUDER_ALERT (cola llena)");
  }
}

// =============================================================================
// TAREA 1: CONTROL EN TIEMPO REAL, SENSORES Y OLED (CORE 1)
// =============================================================================
void vControlTask(void *pvParameters) {
  uint8_t displayDivider = 0;
  unsigned long lastTime = millis();
  unsigned long lastSaveTime = millis();
  uint64_t lastSavedEnergy = 0;
  double energyResidualMicroWh = 0.0;
  unsigned long pirTimer = 0;
  bool pirActive = false;
  bool intruderAlert = false;

  if (lockState(1000)) {
    lastSavedEnergy = g_systemState.energyMicroWh;
    unlockState();
  }

  if (esp_task_wdt_add(NULL) != ESP_OK) {
    Serial.println("[WDT] TWDT no disponible para ControlTask; "
                   "queda el watchdog software de la tarea de red.");
  }

  for (;;) {
    esp_task_wdt_reset();

    unsigned long currentTime = millis();

    // 1. Última medida completa del módulo de metrología.
    //    El muestreo ya no ocurre aquí. Vive en su propia tarea, con su propia
    //    base de tiempos, así que la cadencia de este bucle dejó de influir en
    //    la exactitud. Y `p` es potencia ACTIVA de verdad, integrada como
    //    (1/N)*suma(v[n]*i[n]), no el producto de valores eficaces.
    MeteringResult medida;
    uint32_t medidaAgeMs = 0;
    const bool medidaOk =
        metrologyGetLatest(medida, medidaAgeMs) && medidaAgeMs < METERING_MAX_AGE_MS;

    const float v_ac = medidaOk ? medida.vrms : 0.0f;
    const float i_rms = medidaOk ? medida.irms : 0.0f;
    const float p_watts = medidaOk ? medida.p : 0.0f;

    // 2. Integración de energía y copia local del estado.
    //    Si el mutex no se puede tomar se aborta el ciclo ENTERO sin avanzar
    //    lastTime. Antes, un fallo aquí dejaba currentEnergy en 0.0f y el
    //    bloque de persistencia escribía ese cero sobre el total histórico en
    //    Flash, y además propagaba los cuatro relés a false en el estado.
    SystemMode localMode = SystemMode::NORMAL;
    bool localRelays[4] = {false, false, false, false};
    uint64_t currentEnergy = 0;

    if (!lockState(50)) {
      countLockFailure();
      Serial.println("[ESTADO] Ciclo de control omitido: mutex no disponible.");
      vTaskDelay(pdMS_TO_TICKS(CONTROL_PERIOD_MS));
      continue;
    }

    const double deltaSeconds = (currentTime - lastTime) / 1000.0;
    lastTime = currentTime;

    // uWh = W * s * (1e6 / 3600). El residuo fraccionario se arrastra en un
    // double acotado a [0,1) para no perder nada por truncamiento.
    energyResidualMicroWh += (double)p_watts * deltaSeconds * (1000000.0 / 3600.0);
    if (energyResidualMicroWh >= 1.0) {
      const uint64_t whole = (uint64_t)energyResidualMicroWh;
      g_systemState.energyMicroWh += whole;
      energyResidualMicroWh -= (double)whole;
    }

    currentEnergy = g_systemState.energyMicroWh;
    g_systemState.voltageRMS = v_ac;
    g_systemState.currentRMS = i_rms;
    g_systemState.powerWatts = p_watts;
    g_systemState.reactiveVar = medidaOk ? medida.q : 0.0f;
    g_systemState.apparentVA = medidaOk ? medida.s : 0.0f;
    g_systemState.powerFactor = medidaOk ? medida.pf : 0.0f;
    g_systemState.lineFreq = medidaOk ? medida.freq : 0.0f;
    localMode = g_systemState.mode;
    for (int i = 0; i < 4; i++) {
      localRelays[i] = g_systemState.relayStates[i];
    }
    unlockState();

    // 3. Órdenes de relé llegadas desde la tarea de red (Core 0 -> Core 1)
    RelayCommand cmd;
    while (xQueueReceive(xRelayCommandQueue, &cmd, 0) == pdTRUE) {
      if (cmd.index < 4 && localRelays[cmd.index] != cmd.state) {
        // notifyCloud = false: la orden vino de la nube, reenviarla sería un eco.
        applyRelay(cmd.index, cmd.state, false);
        localRelays[cmd.index] = cmd.state;
        const char* names[] = {"Iluminacion", "Ventilacion", "Confort", "Alarma"};
        Serial.printf("[APP] %s -> %s\n", names[cmd.index], cmd.state ? "ON" : "OFF");
      }
    }

    // 4. Persistencia en Flash NVS.
    //    El respaldo temporal solo dispara si hubo consumo desde el último
    //    guardado; antes reescribía el mismo valor cada 15 minutos a 0 W.
    const uint64_t delta = (currentEnergy > lastSavedEnergy)
                               ? (currentEnergy - lastSavedEnergy)
                               : 0;
    const bool bigDelta = (delta >= NVS_MIN_DELTA_UWH);
    const bool staleWithChange =
        (delta > 0) && ((currentTime - lastSaveTime) > NVS_MAX_INTERVAL_MS);

    if (bigDelta || staleWithChange) {
      if (saveEnergy(currentEnergy)) {
        lastSavedEnergy = currentEnergy;
        lastSaveTime = currentTime;
        Serial.printf("[NVS] Energia guardada: %.6f kWh (seq %lu)\n",
                      (double)currentEnergy / 1e9, (unsigned long)g_energySeq);
      }
    }

    // 5. Lógica de control local (comportamiento por modos).
    //    La Fase 4 del plan sustituye este bloque por el motor de reglas. Aquí
    //    se conserva el comportamiento tal cual, solo cambiando digitalWrite()
    //    por applyRelay() para que pase por la fuente única de verdad.
    if (localMode == SystemMode::ECO) {
      // TODO Fase 4: leer system/config/powerLimit en vez de este 600 fijo.
      if (p_watts > 600.0f && localRelays[2]) {
        applyRelay(2, false, true);
        localRelays[2] = false;
      }
    } else if (localMode == SystemMode::NIGHT) {
      if (digitalRead(PIN_PIR) == HIGH) {
        if (!pirActive) {
          applyRelay(0, true, true);
          localRelays[0] = true;
          pirActive = true;
          pirTimer = currentTime;
        } else {
          pirTimer = currentTime; // Renovar temporizador de presencia
        }
      } else if (pirActive && (currentTime - pirTimer > 30000)) {
        applyRelay(0, false, true);
        localRelays[0] = false;
        pirActive = false;
      }
    } else if (localMode == SystemMode::AWAY) {
      bool isIntentionalUse = localRelays[0] || localRelays[1] || localRelays[2];
      bool pirTriggered = (digitalRead(PIN_PIR) == HIGH);
      bool powerAnomaly = (p_watts > 15.0f && !isIntentionalUse);

      if (pirTriggered || powerAnomaly) {
        if (!intruderAlert) {
          intruderAlert = true;
          applyRelay(3, true, true); // Sirena
          localRelays[3] = true;
          raiseIntruderAlert(true);
        }
      } else if (!intruderAlert && localRelays[3]) {
        applyRelay(3, false, true);
        localRelays[3] = false;
      }
    } else {
      intruderAlert = false;
    }

    // 6. Publicar banderas de alerta y presencia
    if (lockState(50)) {
      g_systemState.intruderAlert = intruderAlert;
      g_systemState.pirActive = pirActive;
      unlockState();
    } else {
      countLockFailure();
    }

    // 7. Watchdog software de la tarea de red
    const uint32_t cloudBeat = g_cloudHeartbeat;
    if (cloudBeat != 0 && (currentTime - cloudBeat) > CLOUD_STALL_MS) {
      Serial.printf("[WDT] CloudSyncTask sin latido durante %lu ms. Reiniciando.\n",
                    (unsigned long)(currentTime - cloudBeat));
      Serial.flush();
      ESP.restart();
    }

    // 8. Refresco de pantalla OLED (cada 10 ciclos)
    if (++displayDivider >= 10) {
      displayDivider = 0;

      bool wifiOk = (WiFi.status() == WL_CONNECTED);
      display.clearDisplay();
      display.setTextColor(SSD1306_WHITE);
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.print("MODO: ");
      String modeStr = modeToString(localMode);
      modeStr.toUpperCase();
      display.print(modeStr);

      display.setCursor(95, 0);
      display.print(wifiOk ? "WIFI" : "OFF");
      display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

      display.setCursor(0, 14);
      display.printf("V:%.0f I:%.2f pf%.2f", v_ac, i_rms,
                     medidaOk ? medida.pf : 0.0f);

      display.setTextSize(2);
      display.setCursor(0, 25);
      display.printf("%.0f W", p_watts);

      display.setTextSize(1);
      display.setCursor(0, 44);
      display.printf("E: %.4f kWh", (double)currentEnergy / 1e9);

      if (localMode == SystemMode::ECO && p_watts > 600.0f) {
        display.setCursor(75, 30);
        display.print("[R3 OFF]");
      } else if (localMode == SystemMode::AWAY && intruderAlert) {
        display.setCursor(65, 30);
        display.print("[INTRUSO!]");
      }

      display.drawLine(0, 53, 128, 53, SSD1306_WHITE);
      display.setCursor(0, 56);
      display.printf("R1:%d R2:%d R3:%d R4:%d",
                     localRelays[0] ? 1 : 0,
                     localRelays[1] ? 1 : 0,
                     localRelays[2] ? 1 : 0,
                     localRelays[3] ? 1 : 0);
      display.display();
    }

    vTaskDelay(pdMS_TO_TICKS(CONTROL_PERIOD_MS));
  }
}

// =============================================================================
// TAREA 0: TELEMETRÍA CLOUD Y SINCRONIZACIÓN FIREBASE (CORE 0)
// =============================================================================
static void queueRelayCommand(uint8_t index, bool state) {
  RelayCommand cmd{index, state};
  if (xQueueSend(xRelayCommandQueue, &cmd, 0) != pdTRUE) {
    countQueueDrop();
    Serial.printf("[COLA] Descartada orden de rele R%u (cola llena)\n",
                  (unsigned)(index + 1));
  }
}

// Procesa un evento del stream de /system/devices.
static void handleDeviceStream(FirebaseData &stream) {
  const String path = stream.dataPath();

  // Snapshot inicial o reescritura del nodo completo: {"1":{"isOn":..}, ...}
  if (path == "/" && stream.dataType() == "json") {
    FirebaseJson *json = stream.to<FirebaseJson *>();
    if (json == nullptr) return;
    FirebaseJsonData result;
    for (int i = 1; i <= 4; i++) {
      char childPath[16];
      snprintf(childPath, sizeof(childPath), "%d/isOn", i);
      if (json->get(result, childPath) && result.type == "boolean") {
        queueRelayCommand((uint8_t)(i - 1), result.to<bool>());
      }
    }
    return;
  }

  // Cambio puntual: /{n}/isOn
  if (stream.dataType() == "boolean") {
    int deviceId = 0;
    if (sscanf(path.c_str(), "/%d/isOn", &deviceId) == 1 &&
        deviceId >= 1 && deviceId <= 4) {
      queueRelayCommand((uint8_t)(deviceId - 1), stream.boolData());
    }
  }
}

void vCloudSyncTask(void *pvParameters) {
  unsigned long lastMetricsTime = 0;
  unsigned long lastPollTime = 0;
  unsigned long lastHealthTime = 0;
  unsigned long lastWifiAttempt = millis();
  bool streamStarted = false;
  bool timeSynced = false;
  uint32_t metricsSeq = 0;

  for (;;) {
    const unsigned long now = millis();
    g_cloudHeartbeat = now ? now : 1; // 0 se reserva como "aún sin latido"

    // 1. Supervisión de WiFi con reintento acotado
    const bool wifiOk = (WiFi.status() == WL_CONNECTED);
    if (!wifiOk) {
      streamStarted = false;
      if (now - lastWifiAttempt >= WIFI_RETRY_MS) {
        lastWifiAttempt = now;
        Serial.println("[WIFI] Sin conexion. Reintentando...");
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      }
    } else {
      lastWifiAttempt = now;
      if (!timeSynced) {
        configTime(0, 0, "pool.ntp.org", "time.nist.gov");
        if (time(nullptr) > 1700000000) {
          timeSynced = true;
          Serial.println("[SNTP] Reloj sincronizado.");
        }
      }
    }

    if (lockState(20)) {
      g_systemState.wifiConnected = wifiOk;
      g_systemState.cloudReady = Firebase.ready();
      unlockState();
    }

    if (wifiOk && Firebase.ready()) {
      // 2. Stream sobre /system/devices.
      //    Sustituye el sondeo de 4 llamadas HTTPS cada 600 ms por una
      //    conexión persistente. Se lee con readStream() dentro de esta misma
      //    tarea en vez de setStreamCallback(), para no crear otra tarea ni
      //    otro juego de buffers TLS.
      if (!streamStarted) {
        if (Firebase.RTDB.beginStream(&fbdoStream, "/system/devices")) {
          streamStarted = true;
          Serial.println("[CLOUD] Stream activo en /system/devices");
        } else {
          Serial.printf("[CLOUD] No se pudo abrir el stream: %s\n",
                        fbdoStream.errorReason().c_str());
        }
      } else {
        if (!Firebase.RTDB.readStream(&fbdoStream)) {
          Serial.printf("[CLOUD] Error de stream: %s\n",
                        fbdoStream.errorReason().c_str());
        }
        if (fbdoStream.streamTimeout()) {
          Serial.println("[CLOUD] Stream expirado, se reabrira.");
          streamStarted = false;
        } else if (fbdoStream.streamAvailable()) {
          handleDeviceStream(fbdoStream);
        }
      }

      // 3. Eventos locales salientes (Core 1 -> Core 0)
      CloudEvent event;
      while (xQueueReceive(xCloudEventQueue, &event, 0) == pdTRUE) {
        if (event.type == CloudEventType::RELAY_SYNC) {
          char path[40];
          snprintf(path, sizeof(path), "/system/devices/%u/isOn", event.deviceIndex);
          Firebase.RTDB.setBool(&fbdo, path, event.state);
        } else if (event.type == CloudEventType::INTRUDER_ALERT) {
          Firebase.RTDB.setBool(&fbdo, "/system/security/alert", event.state);
        }
      }

      // 4. Sondeo de configuración y comandos.
      //    Quedan 2 llamadas cada 1500 ms, frente a las 6 cada 600 ms de antes:
      //    de ~10 peticiones/s a ~1.3/s. Los relés ya no se sondean.
      if (now - lastPollTime >= CONFIG_POLL_MS) {
        lastPollTime = now;

        if (Firebase.RTDB.getString(&fbdo, "/system/config/mode")) {
          SystemMode remoteMode = stringToMode(fbdo.stringData());
          if (lockState(20)) {
            g_systemState.mode = remoteMode;
            unlockState();
          }
        }

        if (Firebase.RTDB.getString(&fbdo, "/system/command/action")) {
          if (fbdo.stringData() == "restart") {
            Firebase.RTDB.setString(&fbdo, "/system/command/action", "none");
            Serial.println("[SISTEMA] Reinicio solicitado desde la nube.");
            Serial.flush();
            vTaskDelay(pdMS_TO_TICKS(500));
            ESP.restart();
          }
        }
      }

      // 5. Telemetría periódica
      if (now - lastMetricsTime >= METRICS_PERIOD_MS) {
        lastMetricsTime = now;

        float v_copy = 0.0f, i_copy = 0.0f, p_copy = 0.0f;
        float q_copy = 0.0f, s_copy = 0.0f, pf_copy = 0.0f, f_copy = 0.0f;
        uint64_t e_copy = 0;
        if (lockState(50)) {
          v_copy = g_systemState.voltageRMS;
          i_copy = g_systemState.currentRMS;
          p_copy = g_systemState.powerWatts;
          q_copy = g_systemState.reactiveVar;
          s_copy = g_systemState.apparentVA;
          pf_copy = g_systemState.powerFactor;
          f_copy = g_systemState.lineFreq;
          e_copy = g_systemState.energyMicroWh;
          unlockState();
        }

        struct timeval tv;
        gettimeofday(&tv, nullptr);
        const uint64_t epochMs =
            (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);

        // Se serializa a mano para controlar cada dígito: 't' son 13 cifras y
        // no sobreviven a un float.
        char payload[288];
        snprintf(payload, sizeof(payload),
                 "{\"v\":%.3f,\"i\":%.4f,\"p\":%.3f,\"q\":%.3f,"
                 "\"s\":%.3f,\"pf\":%.4f,\"f\":%.3f,"
                 "\"e\":%.9f,\"t\":%llu,\"seq\":%lu}",
                 v_copy, i_copy, p_copy, q_copy, s_copy, pf_copy, f_copy,
                 (double)e_copy / 1e9,
                 (unsigned long long)epochMs,
                 (unsigned long)(++metricsSeq));

        FirebaseJson metrics;
        metrics.setJsonData(payload);

        if (Firebase.RTDB.setJSON(&fbdo, "/system/metrics", &metrics)) {
          Serial.printf("[CLOUD] Telemetria -> %.1f W | pf %.3f | %.1f Hz | "
                        "%.6f kWh | t=%llu\n",
                        p_copy, pf_copy, f_copy, (double)e_copy / 1e9,
                        (unsigned long long)epochMs);
        } else {
          Serial.printf("[CLOUD] Fallo al publicar telemetria: %s\n",
                        fbdo.errorReason().c_str());
        }
      }

      // 6. Salud del dispositivo
      if (now - lastHealthTime >= HEALTH_PERIOD_MS) {
        lastHealthTime = now;

        uint32_t drops = 0, lockFails = 0;
        if (lockState(20)) {
          drops = g_systemState.queueDrops;
          lockFails = g_systemState.lockFailures;
          unlockState();
        }

        char payload[224];
        snprintf(payload, sizeof(payload),
                 "{\"rssi\":%d,\"up\":%lu,\"heap\":%lu,\"fw\":\"%s\","
                 "\"resetReason\":\"%d\",\"queueDrops\":%lu}",
                 (int)WiFi.RSSI(),
                 (unsigned long)(now / 1000),
                 (unsigned long)ESP.getFreeHeap(),
                 FW_VERSION,
                 (int)esp_reset_reason(),
                 (unsigned long)(drops + lockFails + metrologyDiscardedWindows()));

        FirebaseJson health;
        health.setJsonData(payload);
        Firebase.RTDB.setJSON(&fbdo, "/system/health", &health);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(CLOUD_PERIOD_MS));
  }
}

// =============================================================================
// SETUP Y CONFIGURACIÓN INICIAL
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\n--- SMART ENERGY MONITOR ULSA v%s ---\n", FW_VERSION);

  // 1. GPIOs. Los relés arrancan en reposo, sea cual sea la polaridad.
  for (int p : PINES_RELES) {
    pinMode(p, OUTPUT);
    digitalWrite(p, RELAY_IDLE_LEVEL);
  }
  pinMode(PIN_PIR, INPUT);
  analogReadResolution(12);

  // 2. I2C y pantalla OLED
  Wire.begin();
  Wire.setClock(400000);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[!] Advertencia: Pantalla OLED no detectada en 0x3C"));
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 15);
    display.println("Smart Energy Monitor");
    display.setCursor(0, 30);
    display.println("Iniciando Core 0 & 1...");
    display.display();
  }

  // 3. Persistencia NVS
  preferences.begin("energy", false);
  g_systemState.energyMicroWh = loadEnergy();
  Serial.printf("[NVS] Energia historica: %.6f kWh (seq %lu)\n",
                (double)g_systemState.energyMicroWh / 1e9,
                (unsigned long)g_energySeq);

  // 4. Primitivas FreeRTOS
  xStateMutex = xSemaphoreCreateMutex();
  xCloudEventQueue = xQueueCreate(20, sizeof(CloudEvent));
  xRelayCommandQueue = xQueueCreate(16, sizeof(RelayCommand));

  if (xStateMutex == NULL || xCloudEventQueue == NULL ||
      xRelayCommandQueue == NULL) {
    Serial.println("[FATAL] Error creando primitivas FreeRTOS.");
    while (1) { delay(1000); }
  }

  // 4b. Tarea de metrologia. Antes del WiFi: no depende de la red para nada
  //     y conviene tener medida disponible cuanto antes.
  if (!metrologyBegin(PIN_VOLTAJE, PIN_CORRIENTE)) {
    Serial.println("[FATAL] No se pudo arrancar la tarea de metrologia.");
    while (1) { delay(1000); }
  }
  Serial.println("[OK] Muestreo de metrologia activo.");

  // 5. Red WiFi no bloqueante
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Conectando en segundo plano a: %s\n", WIFI_SSID);

  // 6. Firebase con la cuenta de servicio del dispositivo.
  //    Antes se llamaba a Firebase.signUp() aquí mismo, justo después de
  //    WiFi.begin() y por tanto sin conexión: fallaba casi siempre, y cuando
  //    funcionaba creaba un usuario anónimo nuevo en cada arranque. La cuenta
  //    fija es además lo que permite que las reglas de la RTDB distingan al
  //    dispositivo de la app.
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  auth.user.email = FIREBASE_USER_EMAIL;
  auth.user.password = FIREBASE_USER_PASSWORD;

  // Traza del ciclo de vida del token. Sin esto, unas credenciales de
  // dispositivo mal puestas se manifiestan solo como "no se publica nada".
  config.token_status_callback = tokenStatusCallback;

  Firebase.reconnectWiFi(true);
  fbdo.setBSSLBufferSize(2048, 2048);
  fbdoStream.setBSSLBufferSize(2048, 1024);
  Firebase.begin(&config, &auth);

  // 7. Tareas FreeRTOS
  xTaskCreatePinnedToCore(vControlTask, "ControlTask", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(vCloudSyncTask, "CloudSyncTask", 10240, NULL, 1, NULL, 0);

  Serial.println("[OK] Sistema operativo e hilos de ejecucion activos.");
}

void loop() {
  // El bucle principal de Arduino se libera para no consumir RAM/CPU
  vTaskDelete(NULL);
}

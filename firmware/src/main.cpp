#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Firebase_ESP_Client.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Wire.h>

// Inclusión de secretos de red y cloud
#if __has_include("secrets.h")
#include "secrets.h"
#else
#define WIFI_SSID "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_CONTRASEÑA_WIFI"
#define FIREBASE_API_KEY "TU_API_KEY"
#define FIREBASE_DATABASE_URL "tu-proyecto.firebaseio.com"
#endif

// =============================================================================
// CONFIGURACIÓN DE HARDWARE Y PARÁMETROS
// =============================================================================
#define USE_POT_SIMULATION true // true: Potenciómetro | false: Sensores AC reales

// Pines de Actuadores y Sensores
const int PINES_RELES[] = {4, 16, 14, 27};
const int PIN_PIR = 26;
const int PIN_VOLTAJE = 35;   // ZMPT101B (ADC1_CH7)
const int PIN_CORRIENTE = 34; // SCT-013 / ACS712 (ADC1_CH6)

// Configuración Pantalla OLED I2C
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET_PIN -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET_PIN);

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

// Estructura de Estado Global Compartido
struct SystemState {
  float voltageRMS = 0.0f;
  float currentRMS = 0.0f;
  float powerWatts = 0.0f;
  float energykWh = 0.0f;
  SystemMode mode = SystemMode::NORMAL;
  bool relayStates[4] = {false, false, false, false};
  bool intruderAlert = false;
  bool pirActive = false;
  bool wifiConnected = false;
  bool cloudReady = false;
};

// Eventos de Control hacia Cloud (Core 1 -> Core 0)
enum class CloudEventType : uint8_t {
  RELAY_SYNC,
  INTRUDER_ALERT
};

struct CloudEvent {
  CloudEventType type;
  uint8_t deviceIndex; // 1 a 4
  bool state;
};

// Primitivas de sincronización FreeRTOS
static SemaphoreHandle_t xStateMutex = NULL;
static QueueHandle_t xCloudEventQueue = NULL;
static SystemState g_systemState;

// Servicios y objetos globales
FirebaseData fbdo;
FirebaseData fbdoStream;
FirebaseAuth auth;
FirebaseConfig config;
Preferences preferences;

// =============================================================================
// FUNCIONES DE MEDICIÓN Y METROLOGÍA
// =============================================================================

float getCurrentRMS(int pin) {
#if USE_POT_SIMULATION
  // Modo simulación por potenciómetro (0 a 30 Amperes)
  int adc_val = analogRead(pin);
  return (adc_val / 4095.0f) * 30.0f;
#else
  // Modo Sensor Real (ACS712 / SCT-013) con integración RMS
  float current_sum = 0.0f;
  const int num_samples = 300;
  const float zero_point = 1880.0f; // Offset ADC en mV
  const float mv_per_amp = 100.0f;  // Sensibilidad (100 mV/A para 20A)

  for (int i = 0; i < num_samples; i++) {
    int adc_val = analogRead(pin);
    float voltage_mv = (adc_val / 4095.0f) * 3300.0f;
    float current_instant = (voltage_mv - zero_point) / mv_per_amp;
    current_sum += (current_instant * current_instant);
    delayMicroseconds(120);
  }

  float current_rms = sqrtf(current_sum / (float)num_samples);
  return (current_rms < 0.08f) ? 0.0f : current_rms; // Filtro de umbral de ruido
#endif
}

float getVoltageAC(int pin) {
#if USE_POT_SIMULATION
  // Modo simulación por potenciómetro (0 a 140 Voltios)
  int adc_val = analogRead(pin);
  return (adc_val / 4095.0f) * 140.0f;
#else
  // Modo Sensor Real (ZMPT101B) con detección de pico y cálculo RMS
  float max_v = 0.0f;
  const int num_samples = 300;

  for (int i = 0; i < num_samples; i++) {
    float v = (analogRead(pin) / 4095.0f) * 3.3f;
    if (v > max_v) {
      max_v = v;
    }
    delayMicroseconds(120);
  }

  float voltage_ac = max_v * 75.0f; // Factor de calibración ZMPT101B
  return (voltage_ac < 15.0f) ? 0.0f : voltage_ac;
#endif
}

// =============================================================================
// TAREA 1: CONTROL EN TIEMPO REAL, SENSORES Y OLED (CORE 1)
// =============================================================================
void vControlTask(void *pvParameters) {
  uint8_t displayDivider = 0;
  unsigned long lastTime = millis();
  unsigned long lastSaveTime = millis();
  float lastSavedEnergy = 0.0f;
  unsigned long pirTimer = 0;
  bool pirActive = false;
  bool intruderAlert = false;

  // Cargar valor de energía inicial acumulada
  if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    lastSavedEnergy = g_systemState.energykWh;
    xSemaphoreGive(xStateMutex);
  }

  for (;;) {
    unsigned long currentTime = millis();
    float deltaTimeHours = (currentTime - lastTime) / 3600000.0f;
    lastTime = currentTime;

    // 1. Adquisición de Señales
    float i_rms = getCurrentRMS(PIN_CORRIENTE);
    float v_ac = getVoltageAC(PIN_VOLTAJE);
    float p_watts = v_ac * i_rms;

    // 2. Obtener copia local de variables de estado
    SystemMode localMode = SystemMode::NORMAL;
    bool localRelays[4] = {false, false, false, false};
    float currentEnergy = 0.0f;

    if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
      g_systemState.energykWh += (p_watts / 1000.0f) * deltaTimeHours;
      currentEnergy = g_systemState.energykWh;
      g_systemState.voltageRMS = v_ac;
      g_systemState.currentRMS = i_rms;
      g_systemState.powerWatts = p_watts;
      localMode = g_systemState.mode;
      for (int i = 0; i < 4; i++) {
        localRelays[i] = g_systemState.relayStates[i];
      }
      xSemaphoreGive(xStateMutex);
    }

    // 3. Persistencia inteligente en Flash NVS (Anti-Wear Leveling)
    // Se guarda solo con delta >= 0.01 kWh o tras 15 minutos sin guardar
    if ((fabsf(currentEnergy - lastSavedEnergy) >= 0.01f) || (currentTime - lastSaveTime > 900000)) {
      preferences.putFloat("total", currentEnergy);
      lastSavedEnergy = currentEnergy;
      lastSaveTime = currentTime;
      Serial.printf("[NVS] Energía guardada de forma segura: %.4f kWh\n", currentEnergy);
    }

    // 4. Lógica de Control Edge (Comportamiento por Modos)
    if (localMode == SystemMode::ECO) {
      // Regla de ahorro energético: desconectar carga de confort si supera 600W
      if (p_watts > 600.0f && localRelays[2]) {
        digitalWrite(PINES_RELES[2], LOW);
        localRelays[2] = false;
        CloudEvent evt{CloudEventType::RELAY_SYNC, 3, false};
        xQueueSend(xCloudEventQueue, &evt, 0);
      }
    } else if (localMode == SystemMode::NIGHT) {
      // Modo Nocturno: Iluminación automática por sensor PIR
      if (digitalRead(PIN_PIR) == HIGH) {
        if (!pirActive) {
          digitalWrite(PINES_RELES[0], HIGH);
          localRelays[0] = true;
          pirActive = true;
          pirTimer = currentTime;
          CloudEvent evt{CloudEventType::RELAY_SYNC, 1, true};
          xQueueSend(xCloudEventQueue, &evt, 0);
        } else {
          pirTimer = currentTime; // Renovar temporizador de presencia
        }
      } else if (pirActive && (currentTime - pirTimer > 30000)) {
        digitalWrite(PINES_RELES[0], LOW);
        localRelays[0] = false;
        pirActive = false;
        CloudEvent evt{CloudEventType::RELAY_SYNC, 1, false};
        xQueueSend(xCloudEventQueue, &evt, 0);
      }
    } else if (localMode == SystemMode::AWAY) {
      // Modo Fuera de Casa: Detección de intrusión por movimiento o consumo no intencional
      bool isIntentionalUse = localRelays[0] || localRelays[1] || localRelays[2];
      bool pirTriggered = (digitalRead(PIN_PIR) == HIGH);
      bool powerAnomaly = (p_watts > 15.0f && !isIntentionalUse);

      if (pirTriggered || powerAnomaly) {
        if (!intruderAlert) {
          intruderAlert = true;
          digitalWrite(PINES_RELES[3], HIGH); // Activar Sirena
          localRelays[3] = true;
          CloudEvent evtRelay{CloudEventType::RELAY_SYNC, 4, true};
          xQueueSend(xCloudEventQueue, &evtRelay, 0);
          CloudEvent evtAlert{CloudEventType::INTRUDER_ALERT, 0, true};
          xQueueSend(xCloudEventQueue, &evtAlert, 0);
        }
      } else if (!intruderAlert) {
        if (localRelays[3]) {
          digitalWrite(PINES_RELES[3], LOW);
          localRelays[3] = false;
        }
      }
    } else {
      // Modo NORMAL
      intruderAlert = false;
    }

    // Actualizar estado de relés y alertas de forma atómica en memoria
    if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
      for (int i = 0; i < 4; i++) {
        g_systemState.relayStates[i] = localRelays[i];
      }
      g_systemState.intruderAlert = intruderAlert;
      g_systemState.pirActive = pirActive;
      xSemaphoreGive(xStateMutex);
    }

    // 5. Refresco de Pantalla OLED (Cada 1000 ms / 10 ciclos)
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
      display.printf("V: %.1fV  I: %.2fA", v_ac, i_rms);

      display.setTextSize(2);
      display.setCursor(0, 25);
      display.printf("%.0f W", p_watts);

      display.setTextSize(1);
      display.setCursor(0, 44);
      display.printf("E: %.4f kWh", currentEnergy);

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

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// =============================================================================
// TAREA 0: TELEMETRÍA CLOUD Y SINCRONIZACIÓN FIREBASE (CORE 0)
// =============================================================================
void vCloudSyncTask(void *pvParameters) {
  unsigned long lastMetricsTime = 0;
  unsigned long lastPollTime = 0;
  bool firebaseInitialized = false;

  for (;;) {
    // 1. Verificación de Conectividad WiFi y Autenticación Firebase
    if (WiFi.status() == WL_CONNECTED) {
      if (!firebaseInitialized && Firebase.ready()) {
        firebaseInitialized = true;
        Serial.println("[CLOUD] Firebase RTDB listo para sincronización.");
      }
    }

    if (firebaseInitialized && Firebase.ready()) {
      // 2. Procesar Eventos Locales Salientes de la Cola (Core 1 -> Core 0)
      CloudEvent event;
      while (xQueueReceive(xCloudEventQueue, &event, 0) == pdTRUE) {
        if (event.type == CloudEventType::RELAY_SYNC) {
          char path[32];
          snprintf(path, sizeof(path), "system/devices/%u/isOn", event.deviceIndex);
          Firebase.RTDB.setBool(&fbdo, path, event.state);
        } else if (event.type == CloudEventType::INTRUDER_ALERT) {
          Firebase.RTDB.setBool(&fbdo, "system/security/alert", event.state);
        }
      }

      // 3. Sincronizar Comandos y Configuración Entrante (Cada 600 ms)
      unsigned long now = millis();
      if (now - lastPollTime >= 600) {
        lastPollTime = now;

        // A. Modo de Operación
        if (Firebase.RTDB.getString(&fbdo, "system/config/mode")) {
          SystemMode remoteMode = stringToMode(fbdo.stringData());
          if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
            g_systemState.mode = remoteMode;
            xSemaphoreGive(xStateMutex);
          }
        }

        // B. Control Remoto de Relés
        for (int i = 0; i < 4; i++) {
          char path[32];
          snprintf(path, sizeof(path), "system/devices/%d/isOn", i + 1);
          if (Firebase.RTDB.getBool(&fbdo, path)) {
            bool targetState = fbdo.boolData();
            bool currentState = (digitalRead(PINES_RELES[i]) == HIGH);

            if (currentState != targetState) {
              digitalWrite(PINES_RELES[i], targetState ? HIGH : LOW);
              if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
                g_systemState.relayStates[i] = targetState;
                xSemaphoreGive(xStateMutex);
              }
              const char* names[] = {"Iluminación", "Ventilación", "Confort", "Alarma"};
              Serial.printf("[APP] %s -> %s\n", names[i], targetState ? "ON" : "OFF");
            }
          }
        }

        // C. Comando de Reinicio Remoto
        if (Firebase.RTDB.getString(&fbdo, "system/command/action")) {
          if (fbdo.stringData() == "restart") {
            Firebase.RTDB.setString(&fbdo, "system/command/action", "none");
            Serial.println("[SISTEMA] Comando de reinicio recibido desde Cloud. Reiniciando...");
            vTaskDelay(pdMS_TO_TICKS(500));
            ESP.restart();
          }
        }
      }

      // 4. Subida Periódica de Telemetría (Cada 2000 ms)
      if (now - lastMetricsTime >= 2000) {
        lastMetricsTime = now;

        float v_copy = 0.0f, i_copy = 0.0f, p_copy = 0.0f, e_copy = 0.0f;
        if (xSemaphoreTake(xStateMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
          v_copy = g_systemState.voltageRMS;
          i_copy = g_systemState.currentRMS;
          p_copy = g_systemState.powerWatts;
          e_copy = g_systemState.energykWh;
          xSemaphoreGive(xStateMutex);
        }

        float pf_copy = (p_copy > 0.0f) ? 0.98f : 0.0f;

        FirebaseJson metrics;
        metrics.set("v", v_copy);
        metrics.set("i", i_copy);
        metrics.set("p", p_copy);
        metrics.set("pf", pf_copy);
        metrics.set("e", e_copy);

        if (Firebase.RTDB.setJSON(&fbdo, "system/metrics", &metrics)) {
          Serial.printf("[CLOUD] Telemetría enviada -> %.1f W | %.4f kWh\n", p_copy, e_copy);
        }
      }
    }

    // Delay de respiro para alimentar el Watchdog Timer (WDT) de Core 0
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// =============================================================================
// SETUP Y CONFIGURACIÓN INICIAL
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n--- INICIANDO SMART ENERGY MONITOR ULSA ---");

  // 1. Inicialización de GPIOs
  for (int p : PINES_RELES) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }
  pinMode(PIN_PIR, INPUT);
  analogReadResolution(12);

  // 2. Inicialización I2C de Alta Velocidad (400 kHz Fast Mode) y Pantalla OLED
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

  // 3. Persistencia en Memoria NVS
  preferences.begin("energy", false);
  g_systemState.energykWh = preferences.getFloat("total", 0.0f);
  Serial.printf("[NVS] Energía histórica recuperada: %.4f kWh\n", g_systemState.energykWh);

  // 4. Creación de Primitivas FreeRTOS
  xStateMutex = xSemaphoreCreateMutex();
  xCloudEventQueue = xQueueCreate(20, sizeof(CloudEvent));

  if (xStateMutex == NULL || xCloudEventQueue == NULL) {
    Serial.println("[FATAL] Error creando primitivas FreeRTOS.");
    while (1) { delay(1000); }
  }

  // 5. Inicialización de Red WiFi No Bloqueante
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WIFI] Conectando en segundo plano a: %s\n", WIFI_SSID);

  // 6. Configuración de Firebase Client
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("[OK] Firebase Auth Exitoso");
  } else {
    Serial.printf("[!] Firebase Auth: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // 7. Lanzamiento de Tareas FreeRTOS en Núcleos Separados
  // Tarea de Control y Adquisición en CORE 1 (Prioridad 2 - Tiempo Real)
  xTaskCreatePinnedToCore(vControlTask, "ControlTask", 4096, NULL, 2, NULL, 1);

  // Tarea de Red y Sincronización en CORE 0 (Prioridad 1 - Tarea de Fondo)
  xTaskCreatePinnedToCore(vCloudSyncTask, "CloudSyncTask", 8192, NULL, 1, NULL, 0);

  Serial.println("[OK] Sistema operativo e hilos de ejecución activos.");
}

void loop() {
  // El bucle principal de Arduino se libera para no consumir RAM/CPU
  vTaskDelete(NULL);
}
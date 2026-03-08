#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Firebase_ESP_Client.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Wire.h>

// 1. CREDENCIALES DE RED Y CLOUD
#define WIFI_SSID "TU_WIFI"
#define WIFI_PASSWORD "TU_PASS"
#define API_KEY "AIzaSyDKPdI9xkrFVOEJ83moYlzHKyHbyOWIiP0"
#define DATABASE_URL "https://smart-energy-ulsa-default-rtdb.firebaseio.com/"

// 2. HARDWARE DE LA MAQUETA (Nivel Industrial)
// Relés: D13(R1-Iluminacion), D12(R2-Ventilacion), D14(R3-Confort),
// D27(R4-Sirena)
const int PINES_RELES[] = {13, 12, 14, 27};
const int PIN_PIR = 26;

// SENSORES ANÁLOGOS (CA)
const int PIN_VOLTAJE = 35;   // ZMPT101B
const int PIN_CORRIENTE = 34; // SCT-013 / ACS712

// 3. CONFIGURACIÓN PANTALLA OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// 4. RTOS Y VARIABLES DE ESTADO
SemaphoreHandle_t xFirebaseMutex;
float energykWh = 0;
String currentMode = "normal";

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
Preferences preferences;

// ==========================================
// FUNCIONES DE MEDICIÓN ANÁLOGA RMS (C.A.)
// ==========================================

// Función para leer Corriente RMS (A) usando el sensor análogo
// Nota: Requiere 1000 muestras para escanear varias ondas senoidales a 60Hz.
float getCurrentRMS(int pin) {
  float current_sum = 0;
  int num_samples = 1000;
  float zero_point =
      1880; // Idealmente el ADC en reposo marca ~1880 (varía por placa)
  float mv_per_amp =
      100.0; // Sensibilidad del ACS712 20A es 100mV/A (Ajustar según sensor)

  for (int i = 0; i < num_samples; i++) {
    int adc_val = analogRead(pin);
    // Convertir ADC a Voltaje (ESP32 tiene 3.3V en 4095 pasos)
    float voltage = (adc_val / 4095.0) * 3300.0;

    // Obtenemos la diferencia respecto al punto cero y calculamos miliamperios
    // instantáneos
    float current_instant = (voltage - zero_point) / mv_per_amp;

    // Suma de cuadrados para RMS
    current_sum += sq(current_instant);
    delayMicroseconds(100);
  }

  // Raiz Cuadrada Media (RMS)
  float current_rms = sqrt(current_sum / num_samples);

  // Filtro de ruido
  if (current_rms < 0.05)
    current_rms = 0;
  return current_rms;
}

// Función súper simplificada para leer Voltaje AC (ZMPT101B)
float getVoltageAC(int pin) {
  float max_v = 0;
  for (int i = 0; i < 500; i++) {
    float v = (analogRead(pin) / 4095.0) * 3.3; // Convertir a V DC
    if (v > max_v)
      max_v = v;
    delayMicroseconds(100);
  }
  // Mapeo crudo para la Maqueta: ZMPT101B ajustado
  // (Este mapeo dependerá del potenciómetro que traiga el módulo azul ZMPT)
  float voltage_ac = max_v * 75.0;
  if (voltage_ac < 20)
    voltage_ac = 0; // Filtro de ruido
  return voltage_ac;
}

// ==========================================
// TAREA 1: CONTROL FÍSICO Y MEDICIÓN
// ==========================================
void vControlTask(void *pvParameters) {
  int displayTimer = 0;
  unsigned long lastTime = millis();
  unsigned long lastSaveTime = millis();

  unsigned long pirTimer = 0;
  bool pirActive = false;
  bool intruderAlert = false;

  for (;;) {
    unsigned long currentTime = millis();
    float deltaTimeHours = (currentTime - lastTime) / 3600000.0;
    lastTime = currentTime;

    // A. Adquisición de Datos AC (Potencia Real)
    float i_rms = getCurrentRMS(PIN_CORRIENTE);
    float v_ac = getVoltageAC(PIN_VOLTAJE);

    // En Corriente Alterna monofásica: P = V * I (Potencia Aparente, asumida
    // como Real para maqueta resistiva)
    float p_watts = v_ac * i_rms;

    // B. Integración Matemática de Energía (kWh)
    if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
      energykWh += (p_watts / 1000.0) * deltaTimeHours;
      xSemaphoreGive(xFirebaseMutex);
    }

    // Guardado de estado EPROM
    if (currentTime - lastSaveTime > 60000) {
      preferences.putFloat("total", energykWh);
      lastSaveTime = currentTime;
      Serial.printf("[SISTEMA] Energía guardada: %.4f kWh\n", energykWh);
    }

    // C. Lógica Inteligente Híbrida (Edge Computing local)
    if (currentMode == "eco") {
      // Prioridad: Apagar Carga de Confort (Relé 3) si hay sobrecarga local
      // (Fail-safe ultra rápido)
      if (p_watts > 600) {
        digitalWrite(PINES_RELES[2], LOW);
      }
    } else if (currentMode == "night") {
      digitalWrite(PINES_RELES[2], LOW); // Confort OFF
      if (digitalRead(PIN_PIR) == HIGH) {
        digitalWrite(PINES_RELES[0], HIGH); // Iluminación PIR
        pirTimer = currentTime;
        pirActive = true;
      } else if (pirActive && (currentTime - pirTimer > 30000)) {
        digitalWrite(PINES_RELES[0], LOW);
        pirActive = false;
      }
    } else if (currentMode == "away") {
      bool isIntentionalUse = (digitalRead(PINES_RELES[0]) == HIGH) ||
                              (digitalRead(PINES_RELES[1]) == HIGH) ||
                              (digitalRead(PINES_RELES[2]) == HIGH);

      // Intruso = PIR moviendo O (+10W sin ser tú)
      if (digitalRead(PIN_PIR) == HIGH || (p_watts > 10 && !isIntentionalUse)) {
        intruderAlert = true;
        digitalWrite(PINES_RELES[3], HIGH); // Sirena ON
      } else if (!intruderAlert) {
        digitalWrite(PINES_RELES[3], LOW); // Sirena OFF
      }
    } else {
      intruderAlert = false;
      // Fail-Safe Físico: Apagón de emergencia local si la corriente supera los
      // 15 Amperios (Cortocircuito)
      if (i_rms > 15.0) {
        digitalWrite(PINES_RELES[0], LOW);
        digitalWrite(PINES_RELES[1], LOW);
        digitalWrite(PINES_RELES[2], LOW);
      }
    }

    // D. HMI - Pantalla OLED
    if (++displayTimer >= 10) {
      display.clearDisplay();
      display.setTextColor(WHITE);

      // Header
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.print("MODO:");
      String modeUpper = currentMode;
      modeUpper.toUpperCase();
      display.print(modeUpper);
      display.setCursor(95, 0);
      display.print(WiFi.status() == WL_CONNECTED ? "WIFI" : "OFF");
      display.drawLine(0, 10, 128, 10, WHITE);

      // Body (Lecturas AC Verdaderas)
      display.setCursor(0, 15);
      display.printf("V: %.1fV", v_ac);
      display.setCursor(70, 15);
      display.printf("I: %.2fA", i_rms);

      display.setTextSize(2);
      display.setCursor(0, 26);
      display.printf("%.0f W", p_watts);
      display.setTextSize(1);

      display.setCursor(0, 45);
      display.printf("E: %.4fkWh", energykWh);

      // Alertas
      if (currentMode == "eco" && p_watts > 600) {
        display.setCursor(70, 32);
        display.print("[R3 OFF]");
      } else if (currentMode == "away" && intruderAlert) {
        display.setCursor(70, 32);
        display.print("[INTRUSO!]");
      }

      // Footer
      display.drawLine(0, 54, 128, 54, WHITE);
      display.setCursor(0, 56);
      display.printf("R1:%d R2:%d R3:%d R4:%d", digitalRead(PINES_RELES[0]),
                     digitalRead(PINES_RELES[1]), digitalRead(PINES_RELES[2]),
                     digitalRead(PINES_RELES[3]));
      display.display();
      displayTimer = 0;
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ==========================================
// TAREA 0: TELEMETRÍA CLOUD
// ==========================================
void vCloudSyncTask(void *pvParameters) {
  for (;;) {
    if (Firebase.ready()) {
      if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(100)) == pdTRUE) {

        // 1. Sincronizar Modo
        if (Firebase.RTDB.getString(&fbdo, "system/config/mode")) {
          currentMode = fbdo.stringData();
        }

        // 2. Controladores (Relés 1 y 2 asientan órdenes de App)
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/1/isOn")) {
          digitalWrite(PINES_RELES[0], fbdo.boolData() ? HIGH : LOW);
        }
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/2/isOn")) {
          digitalWrite(PINES_RELES[1], fbdo.boolData() ? HIGH : LOW);
        }
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/3/isOn")) {
          digitalWrite(PINES_RELES[2], fbdo.boolData() ? HIGH : LOW);
        }

        // 3. Reinicio Remoto
        if (Firebase.RTDB.getString(&fbdo, "system/command/action")) {
          if (fbdo.stringData() == "restart") {
            Firebase.RTDB.setString(&fbdo, "system/command/action", "none");
            delay(500);
            ESP.restart();
          }
        }

        // 4. Subida de Métricas con Vóltaje y Amperaje leídos en Tarea 1
        // Como la Tarea 1 lee contínuamente (Loop 100ms), obtenemos el RMS
        // reciente recalculado
        float i_rms_upload = getCurrentRMS(PIN_CORRIENTE);
        float v_ac_upload = getVoltageAC(PIN_VOLTAJE);
        float p_upload = v_ac_upload * i_rms_upload;

        // Calcular Factor de Potencia (Simulado para resistivo puro = 1.0)
        float pf_upload = (p_upload > 0) ? 0.98 : 0.0;

        FirebaseJson metrics;
        metrics.set("v", v_ac_upload);
        metrics.set("i", i_rms_upload);
        metrics.set("p", p_upload);
        metrics.set("pf", pf_upload);
        metrics.set("e", energykWh);
        Firebase.RTDB.setJSON(&fbdo, "system/metrics", &metrics);

        xSemaphoreGive(xFirebaseMutex);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(1500)); // Refresco Real-Time Firebase a 1.5s
  }
}

void setup() {
  Serial.begin(115200);

  // Inicializar Relés y Sensores
  for (int p : PINES_RELES)
    pinMode(p, OUTPUT);
  pinMode(PIN_PIR, INPUT);

  // Aumentar la resolución del ADC del ESP32 a 12 bits para mayor precisión en
  // Corriente Alterna
  analogReadResolution(12);

  // Config Pantalla OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("Fallo crítico: No se detecta OLED"));
  } else {
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setCursor(0, 20);
    display.println("Iniciando Sistema...");
    display.display();
  }

  // Cargar Energía desde Flash EPROM
  preferences.begin("energy", false);
  energykWh = preferences.getFloat("total", 0.0);

  // Conexión Red y Firebase
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Lanzar RTOS (Multihilo)
  xFirebaseMutex = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(vControlTask, "Control", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(vCloudSyncTask, "Cloud", 8192, NULL, 1, NULL, 0);

  Serial.println("Firmware Desplegado Correctamente.");
}

void loop() { vTaskDelete(NULL); }
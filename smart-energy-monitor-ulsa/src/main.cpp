#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Firebase_ESP_Client.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Wire.h>

// 1. CREDENCIALES DE RED Y CLOUD
#define WIFI_SSID "CLARO1_2DF870"
#define WIFI_PASSWORD "000WXsnopo"
#define API_KEY "AIzaSyDKPdI9xkrFVOEJ83moYlzHKyHbyOWIiP0"
#define DATABASE_URL "smart-energy-ulsa-default-rtdb.firebaseio.com"

// 2. HARDWARE DE LA MAQUETA (Nivel Industrial)
const int PINES_RELES[] = {4, 16, 14, 27};
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

float getCurrentRMS(int pin) {
  // --- MODO SIMULACIÓN POTENCIÓMETRO (0 a 30 Amperes) ---
  int adc_val = analogRead(pin);
  return (adc_val / 4095.0) * 30.0;

  /* --- MODO SENSOR REAL (Comentado temporalmente) ---
  float current_sum = 0;
  int num_samples = 1000;
  float zero_point = 1880.0; // Ajustar según lectura ADC en reposo
  float mv_per_amp = 100.0;  // Sensibilidad ACS712 20A: 100mV/A

  for (int i = 0; i < num_samples; i++) {
    int adc_val = analogRead(pin);
    float voltage = (adc_val / 4095.0) * 3300.0;
    float current_instant = (voltage - zero_point) / mv_per_amp;
    current_sum += sq(current_instant);
    delayMicroseconds(100);
  }

  float current_rms = sqrt(current_sum / num_samples);
  if (current_rms < 0.05)
    current_rms = 0; // Filtro de ruido
  return current_rms;
  */
}

float getVoltageAC(int pin) {
  // --- MODO SIMULACIÓN POTENCIÓMETRO (0 a 140 Voltios) ---
  int adc_val = analogRead(pin);
  return (adc_val / 4095.0) * 140.0;

  /* --- MODO SENSOR REAL (Comentado temporalmente) ---
  float max_v = 0;
  for (int i = 0; i < 500; i++) {
    float v = (analogRead(pin) / 4095.0) * 3.3;
    if (v > max_v)
      max_v = v;
    delayMicroseconds(100);
  }
  float voltage_ac = max_v * 75.0; // Calibración ZMPT101B
  if (voltage_ac < 20)
    voltage_ac = 0;
  return voltage_ac;
  */
}

// ==========================================
// TAREA 1: CONTROL FÍSICO Y MEDICIÓN (CORE 1)
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

    // A. Adquisición de Datos
    float i_rms = getCurrentRMS(PIN_CORRIENTE);
    float v_ac = getVoltageAC(PIN_VOLTAJE);
    float p_watts = v_ac * i_rms;

    // B. Integración de Energía
    if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
      energykWh += (p_watts / 1000.0) * deltaTimeHours;
      xSemaphoreGive(xFirebaseMutex);
    }

    // Guardado en Flash cada 60s
    if (currentTime - lastSaveTime > 60000) {
      preferences.putFloat("total", energykWh);
      lastSaveTime = currentTime;
      Serial.printf("[SISTEMA] Energía guardada: %.4f kWh\n", energykWh);
    }

    // C. Lógica Inteligente Híbrida (Edge Computing local)
    if (currentMode == "eco") {
      // (Test Mode) Comentado por ruido analógico: if (p_watts > 600)
      // digitalWrite(PINES_RELES[2], LOW);
    } else if (currentMode == "night") {
      // (Test Mode) Comentado por ruido: digitalWrite(PINES_RELES[2], LOW); //
      // Confort OFF
      if (digitalRead(PIN_PIR) == HIGH) {
        if (!pirActive) {
          if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(20)) == pdTRUE) {
            digitalWrite(PINES_RELES[0], HIGH); // Iluminación PIR
            Firebase.RTDB.setBool(&fbdo, "system/devices/1/isOn", true);
            pirTimer = currentTime;
            pirActive = true;
            xSemaphoreGive(xFirebaseMutex);
          }
        } else {
          pirTimer = currentTime;
        }
      } else if (pirActive && (currentTime - pirTimer > 30000)) {
        if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(20)) == pdTRUE) {
          digitalWrite(PINES_RELES[0], LOW);
          Firebase.RTDB.setBool(&fbdo, "system/devices/1/isOn", false);
          pirActive = false;
          xSemaphoreGive(xFirebaseMutex);
        }
      }
    } else if (currentMode == "away") {
      bool isIntentionalUse = (digitalRead(PINES_RELES[0]) == HIGH) ||
                              (digitalRead(PINES_RELES[1]) == HIGH) ||
                              (digitalRead(PINES_RELES[2]) == HIGH);
      // Intruso = PIR moviendo O (+10W sin ser tú)
      if (digitalRead(PIN_PIR) == HIGH || (p_watts > 10 && !isIntentionalUse)) {
        if (!intruderAlert) {
          if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(20)) == pdTRUE) {
            intruderAlert = true;
            digitalWrite(PINES_RELES[3], HIGH); // Sirena ON
            Firebase.RTDB.setBool(&fbdo, "system/devices/4/isOn", true);
            xSemaphoreGive(xFirebaseMutex);
          }
        }
      } else if (!intruderAlert) {
        digitalWrite(PINES_RELES[3], LOW); // Sirena OFF
      }
    } else {
      intruderAlert = false;
      // Fail-Safe Físico: (Test Mode) Comentado temporalmente por fluctuaciones
      // fantasmas sin hardware. if (i_rms > 15.0) {
      //   digitalWrite(PINES_RELES[0], LOW);
      //   digitalWrite(PINES_RELES[1], LOW);
      //   digitalWrite(PINES_RELES[2], LOW);
      // }
    }

    // D. Pantalla OLED
    if (++displayTimer >= 10) {
      display.clearDisplay();
      display.setTextColor(WHITE);
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.print("MODO: ");
      String modeUpper = currentMode;
      modeUpper.toUpperCase();
      display.print(modeUpper);
      display.setCursor(95, 0);
      display.print(WiFi.status() == WL_CONNECTED ? "WIFI" : "OFF");
      display.drawLine(0, 10, 128, 10, WHITE);

      display.setCursor(0, 15);
      display.printf("V: %.1fV  I: %.2fA", v_ac, i_rms);
      display.setTextSize(2);
      display.setCursor(0, 26);
      display.printf("%.0f W", p_watts);
      display.setTextSize(1);
      display.setCursor(0, 45);
      display.printf("E: %.4fkWh", energykWh);

      if (currentMode == "eco" && p_watts > 600) {
        display.setCursor(70, 32);
        display.print("[R3 OFF]");
      } else if (currentMode == "away" && intruderAlert) {
        display.setCursor(70, 32);
        display.print("[INTRUSO!]");
      }

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
// TAREA 0: TELEMETRÍA CLOUD (CORE 0)
// ==========================================
void vCloudSyncTask(void *pvParameters) {
  unsigned long lastMetricsTime = 0;
  for (;;) {
    if (Firebase.ready()) {
      if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        // 1. Sincronizar Modo
        if (Firebase.RTDB.getString(&fbdo, "system/config/mode")) {
          currentMode = fbdo.stringData();
        }

        // 2. Controladores
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/1/isOn")) {
          bool val = fbdo.boolData();
          if (digitalRead(PINES_RELES[0]) != val) {
            digitalWrite(PINES_RELES[0], val ? HIGH : LOW);
            Serial.printf("[APP] 💡 Iluminación %s\n", val ? "ON" : "OFF");
          }
        }
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/2/isOn")) {
          bool val = fbdo.boolData();
          if (digitalRead(PINES_RELES[1]) != val) {
            digitalWrite(PINES_RELES[1], val ? HIGH : LOW);
            Serial.printf("[APP] ❄️ Ventilación %s\n", val ? "ON" : "OFF");
          }
        }
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/3/isOn")) {
          bool val = fbdo.boolData();
          if (digitalRead(PINES_RELES[2]) != val) {
            digitalWrite(PINES_RELES[2], val ? HIGH : LOW);
            Serial.printf("[APP] 🛋️ Confort %s\n", val ? "ON" : "OFF");
          }
        }
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/4/isOn")) {
          bool val = fbdo.boolData();
          if (digitalRead(PINES_RELES[3]) != val) {
            digitalWrite(PINES_RELES[3], val ? HIGH : LOW);
            Serial.printf("[APP] 🚨 Sistema de Alarma %s\n",
                          val ? "ON" : "OFF");
          }
        }

        // 3. Reinicio Remoto
        if (Firebase.RTDB.getString(&fbdo, "system/command/action")) {
          if (fbdo.stringData() == "restart") {
            Firebase.RTDB.setString(&fbdo, "system/command/action", "none");
            delay(500);
            ESP.restart();
          }
        }

        // 4. Subida de Métricas (Cada 2 segundos)
        if (millis() - lastMetricsTime > 2000) {
          lastMetricsTime = millis();

          float i_u = getCurrentRMS(PIN_CORRIENTE);
          float v_u = getVoltageAC(PIN_VOLTAJE);

          // Los datos reales de voltaje y corriente ahora provienen
          // directamente de los giros del potenciómetro físico mediante las
          // funciones de arriba.

          // Simular consumo acelerado para ver subir la gráfica de costo ($) en
          // la App
          energykWh += 0.5;
          // ------------------------------------------------

          float p_u = v_u * i_u;
          float pf_u = (p_u > 0) ? 0.98 : 0.0;

          FirebaseJson metrics;
          metrics.set("v", v_u);
          metrics.set("i", i_u);
          metrics.set("p", p_u);
          metrics.set("pf", pf_u);
          metrics.set("e", energykWh);

          if (Firebase.RTDB.setJSON(&fbdo, "system/metrics", &metrics)) {
            Serial.printf("[CLOUD] Telemetría OK -> %.1f W\n", p_u);
          }
        }

        xSemaphoreGive(xFirebaseMutex);
      }
    }

    // El delay DEBE estar fuera del 'if (Firebase.ready())'
    // para alimentar al Watchdog Timer (WDT) del core 0 siempre.
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

void setup() {
  Serial.begin(115200);

  for (int p : PINES_RELES)
    pinMode(p, OUTPUT);
  pinMode(PIN_PIR, INPUT);
  analogReadResolution(12);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("OLED no detectado"));
  } else {
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setCursor(0, 20);
    display.println("Iniciando...");
    display.display();
  }

  preferences.begin("energy", false);
  energykWh = preferences.getFloat("total", 0.0);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando a WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[OK] WiFi Conectado.");

  // Configuración Firebase (Requiere habilitar "Anónimo" en Firebase Console)
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("[OK] Firebase Auth Exitoso (Console)");
  } else {
    Serial.printf("[!] Error Auth: %s\n",
                  config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  xFirebaseMutex = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(vControlTask, "Control", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(vCloudSyncTask, "Cloud", 8192, NULL, 1, NULL, 0);

  Serial.println("Firmware Desplegado.");
}

void loop() { vTaskDelete(NULL); }
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

// 2. HARDWARE MVP (Prueba de Concepto)
const int PINES_RELES[] = {13, 12, 14, 27};
const int PIN_PIR = 26;
const int PIN_VOLTAJE = 35;
const int PIN_CORRIENTE = 34;

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

// --- TAREA CORE 1: CONTROL Y HMI (Prioridad Alta) ---
void vControlTask(void *pvParameters) {
  int displayTimer = 0;
  unsigned long lastTime = millis();     // Para el cálculo de energía
  unsigned long lastSaveTime = millis(); // Para guardar en Flash

  // Variables para la lógica Night y Away
  unsigned long pirTimer = 0;
  bool pirActive = false;
  bool intruderAlert = false;

  for (;;) {
    unsigned long currentTime = millis();
    float deltaTimeHours =
        (currentTime - lastTime) / 3600000.0; // Convertir ms a horas
    lastTime = currentTime;

    // A. Adquisición de Datos Industriales
    float v = map(analogRead(PIN_VOLTAJE), 0, 4095, 0, 130);
    float i = map(analogRead(PIN_CORRIENTE), 0, 4095, 0, 1500) / 100.0;
    float p = v * i;

    // B. Integración Matemática de Energía (kWh)
    if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
      energykWh += (p / 1000.0) * deltaTimeHours; // W a kW * horas
      xSemaphoreGive(xFirebaseMutex);
    }

    // Guardar en la memoria Flash (EPROM) cada 1 minuto para no desgastarla
    if (currentTime - lastSaveTime > 60000) {
      preferences.putFloat("total", energykWh);
      lastSaveTime = currentTime;
      Serial.printf("[SISTEMA] Energía guardada en Flash: %.4f kWh\n",
                    energykWh);
      Serial.printf("[SISTEMA] Heap Libre: %u bytes\n", ESP.getFreeHeap());
    }

    // C. Lógica Inteligente de Modos (Edge Computing)
    if (currentMode == "eco") {
      // Prioridad: Apagar Carga de Confort (Relé 3 -> Índice 2) si P > 600W
      if (p > 600) {
        digitalWrite(PINES_RELES[2], LOW);
      }
    } else if (currentMode == "night") {
      // Regla 1: Carga de Confort siempre apagada
      digitalWrite(PINES_RELES[2], LOW);

      // Regla 2: Iluminación Pasillo con PIR (Relé 1 -> Índice 0)
      if (digitalRead(PIN_PIR) == HIGH) {
        digitalWrite(PINES_RELES[0], HIGH);
        pirTimer = currentTime;
        pirActive = true;
      } else if (pirActive && (currentTime - pirTimer > 30000)) { // 30 segundos
        digitalWrite(PINES_RELES[0], LOW);
        pirActive = false;
      }
    } else if (currentMode == "away") {
      // Regla 1: Permitimos que Firebase controle los relés (La App Android ya
      // envió orden OFF).

      // Verificamos si algún relevador fue activado intencionalmente (bypass
      // por emergencia)
      bool isIntentionalUse = (digitalRead(PINES_RELES[0]) == HIGH) ||
                              (digitalRead(PINES_RELES[1]) == HIGH) ||
                              (digitalRead(PINES_RELES[2]) == HIGH);

      // Regla 2: Cortocircuito intruso = PIR detecta movimiento O (consumo
      // fantasma > 10W sin uso intencional)
      if (digitalRead(PIN_PIR) == HIGH || (p > 10 && !isIntentionalUse)) {
        intruderAlert = true;
        digitalWrite(PINES_RELES[3], HIGH); // Enciende Sirena
      } else if (!intruderAlert) {
        digitalWrite(PINES_RELES[3], LOW);
      }
    } else {
      // MODO NORMAL:
      intruderAlert = false;
      // En modo normal no forzamos apagados a nivel hardware local a no ser que
      // sea un cortocircuito enorme (>1500W)
      if (p > 1500) {
        digitalWrite(PINES_RELES[0], LOW);
        digitalWrite(PINES_RELES[1], LOW);
        digitalWrite(PINES_RELES[2], LOW);
      }
    }

    // D. Actualización de HMI (Pantalla OLED cada 1 seg)
    if (++displayTimer >= 10) {
      display.clearDisplay();
      display.setTextColor(WHITE);

      // HEADER: Modo y Estado de Red
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.print("MODO:");
      String modeUpper = currentMode;
      modeUpper.toUpperCase();
      display.print(modeUpper);

      display.setCursor(95, 0);
      display.print(WiFi.status() == WL_CONNECTED ? "WIFI" : "OFF");
      display.drawLine(0, 10, 128, 10, WHITE);

      // BODY: Lecturas Tensión, Corriente
      display.setCursor(0, 15);
      display.printf("V: %.1fV", v);
      display.setCursor(70, 15);
      display.printf("I: %.2fA", i);

      // DATO PRINCIPAL: Potencia (Letra Grande)
      display.setTextSize(2);
      display.setCursor(0, 26);
      display.printf("%.0f W", p);
      display.setTextSize(1);

      // ENERGÍA
      display.setCursor(0, 45);
      display.printf("E: %.4fkWh", energykWh);

      // ALERTAS: Sobrescriben o flotan al centro/derecha
      if (currentMode == "eco" && p > 600) {
        display.setCursor(70, 32);
        display.print("[R3 OFF]");
      } else if (currentMode == "away" && intruderAlert) {
        display.setCursor(70, 32);
        display.print("[INTRUSO]");
      }

      // FOOTER: Estado directo de los pines físicos!
      display.drawLine(0, 54, 128, 54, WHITE);
      display.setCursor(0, 56);
      display.printf("R1:%d  R2:%d  R3:%d  R4:%d", digitalRead(PINES_RELES[0]),
                     digitalRead(PINES_RELES[1]), digitalRead(PINES_RELES[2]),
                     digitalRead(PINES_RELES[3]));

      display.display();
      displayTimer = 0;
    }

    vTaskDelay(pdMS_TO_TICKS(100)); // Lazo de 100ms
  }
}

// --- TAREA CORE 0: TELEMETRÍA CLOUD (Prioridad Baja) ---
void vCloudSyncTask(void *pvParameters) {
  for (;;) {
    if (Firebase.ready()) {
      if (xSemaphoreTake(xFirebaseMutex, pdMS_TO_TICKS(100)) == pdTRUE) {

        // 1. Descargar Estado de Configuración y Modo
        if (Firebase.RTDB.getString(&fbdo, "system/config/mode")) {
          currentMode = fbdo.stringData();
        }

        // 2. Escucha Bidireccional de Relés (Control Remoto App)
        // Verificamos el estado del relé 1 y 2 en la base de datos
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/1/isOn")) {
          // Si no estamos en modo eco con sobrecarga, permitimos el control
          digitalWrite(PINES_RELES[0], fbdo.boolData() ? HIGH : LOW);
        }
        if (Firebase.RTDB.getBool(&fbdo, "system/devices/2/isOn")) {
          digitalWrite(PINES_RELES[1], fbdo.boolData() ? HIGH : LOW);
        }

        // 3. Escuchar Comando de Reinicio Remoto
        if (Firebase.RTDB.getString(&fbdo, "system/command/action")) {
          if (fbdo.stringData() == "restart") {
            Serial.println(
                "[ALERTA] Comando de reinicio recibido desde la App.");
            // Limpiamos el comando en Firebase para evitar un bucle de
            // reinicios
            Firebase.RTDB.setString(&fbdo, "system/command/action", "none");
            delay(500);    // Pequeña pausa para asegurar que Firebase guardó el
                           // "none"
            ESP.restart(); // Reinicio por hardware
          }
        }

        // 4. Subida de Métricas a Firebase
        FirebaseJson metrics;
        metrics.set("v", map(analogRead(PIN_VOLTAJE), 0, 4095, 0, 130));
        metrics.set("e", energykWh);
        Firebase.RTDB.setJSON(&fbdo, "system/metrics", &metrics);

        xSemaphoreGive(xFirebaseMutex);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(2000)); // Actualización Cloud cada 2s
  }
}

void setup() {
  Serial.begin(115200);

  for (int p : PINES_RELES)
    pinMode(p, OUTPUT);
  pinMode(PIN_PIR, INPUT);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("Fallo crítico: No se detecta OLED"));
  } else {
    display.clearDisplay();
    display.setTextColor(WHITE);
    display.setCursor(0, 20);
    display.println("Iniciando Sistema...");
    display.display();
  }

  preferences.begin("energy", false);
  energykWh = preferences.getFloat("total", 0.0);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  xFirebaseMutex = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(vControlTask, "Control", 4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(vCloudSyncTask, "Cloud", 8192, NULL, 1, NULL, 0);

  Serial.println("Firmware Desplegado Correctamente.");
}

void loop() { vTaskDelete(NULL); }
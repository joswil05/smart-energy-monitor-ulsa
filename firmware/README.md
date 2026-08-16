# ⚡ Smart Energy Monitor ULSA - ESP32 Firmware

Firmware industrial para microcontrolador **ESP32 Dev Module**, encargado de la adquisición analógica de parámetros eléctricos (RMS), lógica de control inteligente local (*Edge Computing*), interfaz HMI local en pantalla OLED I2C y sincronización bidireccional en tiempo real con **Google Firebase RTDB** mediante **FreeRTOS Dual-Core**.

---

## 🛠️ Requisitos de Hardware

- **Microcontrolador:** ESP32 Dev Module (ESP-WROOM-32 / 4MB Flash)
- **Sensor de Voltaje AC:** ZMPT101B (Transformador de voltaje analógico)
- **Sensor de Corriente AC:** ACS712 (20A/30A) o Transformador de corriente SCT-013-000
- **Pantalla Local (HMI):** OLED 0.96" SSD1306 (I2C: 128x64 px)
- **Actuadores:** Módulo de 4 Relés Optoacoplados de 5V
- **Sensor de Presencia:** Sensor de Movimiento PIR HC-SR501 / AM312

---

## 📌 Mapeo de Pines (Pinout)

| Periférico / Función | Pin ESP32 | Tipo | Descripción |
| :--- | :---: | :---: | :--- |
| **Sensor Voltaje AC (ZMPT101B)** | `GPIO 35` | ADC1_CH7 | Entrada analógica (sin conflicto WiFi) |
| **Sensor Corriente AC (ACS712)** | `GPIO 34` | ADC1_CH6 | Entrada analógica (sin conflicto WiFi) |
| **Sensor Movimiento PIR** | `GPIO 26` | Entrada Digital | Detección de presencia (Modo Night / Away) |
| **Relé 1 (Iluminación)** | `GPIO 4` | Salida Digital | Carga 1 (Control manual / Automático PIR) |
| **Relé 2 (Ventilación)** | `GPIO 16` | Salida Digital | Carga 2 |
| **Relé 3 (Confort / Climatización)** | `GPIO 14` | Salida Digital | Carga 3 (Desconexión automática en modo Eco) |
| **Relé 4 (Sirena / Alarma)** | `GPIO 27` | Salida Digital | Alarma disuasoria ante intrusión |
| **OLED SDA** | `GPIO 21` | I2C (400 kHz) | Bus de datos de pantalla |
| **OLED SCL** | `GPIO 22` | I2C (400 kHz) | Bus de reloj de pantalla |

---

## 🏗️ Estructura del Firmware

```text
smart-energy-monitor-ulsa/
├── platformio.ini              # Configuración PlatformIO (1.9MB Flash Partition)
├── include/
│   ├── secrets.h.example       # Plantilla de credenciales WiFi y Firebase
│   ├── secrets.h               # Credenciales locales privadas (Ignorado por Git)
│   └── README
├── src/
│   └── main.cpp                # Firmware C++ (FreeRTOS Tasks, Mutex, Metrología, OLED)
├── lib/                        # Bibliotecas embebidas adicionales
├── test/                       # Tests unitarios
└── .gitignore                  # Reglas de exclusión para Git
```

---

## ⚙️ Configuración y Puesta en Marcha

### 1. Clonar o descargar el repositorio
Asegúrate de contar con **VS Code** y la extensión oficial **PlatformIO IDE**.

### 2. Configurar Secretos de Red y Cloud
Copia el archivo de plantilla:
```bash
cp include/secrets.h.example include/secrets.h
```
Abre `include/secrets.h` y coloca tus credenciales:
```cpp
#define WIFI_SSID "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_CONTRASEÑA_WIFI"

#define FIREBASE_API_KEY "TU_API_KEY_DE_FIREBASE"
#define FIREBASE_DATABASE_URL "tu-proyecto-default-rtdb.firebaseio.com"
```

### 3. Modo Simulación vs Hardware Real
En `src/main.cpp`:
- **Modo Potenciómetro (Simulación de Laboratorio):**
  ```cpp
  #define USE_POT_SIMULATION true
  ```
- **Modo Sensores Reales (ZMPT101B + ACS712/SCT013):**
  ```cpp
  #define USE_POT_SIMULATION false
  ```

### 4. Compilar y Cargar al ESP32
1. Conecta tu ESP32 mediante cable USB de datos.
2. Haz clic en el botón **Upload** (`pio run -t upload`) en la barra inferior de PlatformIO.
3. Abre el **Monitor Serie** a `115200` baudios (`pio device monitor`) para ver los logs en tiempo real.

---

## 🧠 Arquitectura de Software (FreeRTOS Dual-Core)

- **CORE 1 (`vControlTask` - Prioridad 2 / Tiempo Real):** Muestreo continuo RMS de voltaje y corriente, integración de energía activa (kWh), lógica local de modos (Eco, Night, Away), refresco de pantalla OLED a 400 kHz y despacho no bloqueante de eventos a la cola.
- **CORE 0 (`vCloudSyncTask` - Prioridad 1 / Fondo):** Procesamiento de eventos encolados, sincronización de comandos de la App móvil desde Firebase RTDB, transmisión periódica de telemetría y supervisión de conectividad WiFi.
- **Memoria NVS Inteligente:** La energía se almacena en la memoria Flash no volátil mediante un algoritmo diferencial ($\Delta E \ge 0.01\text{ kWh}$) que protege la memoria contra desgaste (*wear leveling*).

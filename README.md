# ⚡ Smart Energy Monitor - ULSA

Sistema IoT de grado industrial para la medición, control y supervisión en tiempo real del consumo eléctrico residencial e industrial, desarrollado con **ESP32 (FreeRTOS)**, **Google Firebase Realtime Database** y una **Aplicación Multiplataforma (React + Vite + Capacitor Android)**.

---

## 🏛️ Arquitectura del Repositorio (Monorepo)

El proyecto está dividido en dos módulos completamente independientes y desacoplados:

```text
smart-energy-monitor-ulsa/
│
├── 📁 app/                           # 📱 APLICACIÓN MÓVIL Y WEB
│   ├── android/                      # Proyecto nativo Android (Capacitor / Android Studio)
│   ├── src/                          # Código fuente React (Componentes, Vistas, Hooks, Firebase)
│   ├── index.html                    # Entrada Web
│   ├── package.json                  # Dependencias de la app
│   ├── vite.config.ts                # Empaquetador Vite
│   ├── tsconfig.json                 # Configuración TypeScript
│   ├── capacitor.config.ts           # Configuración Capacitor Móvil
│   ├── .env.example                  # Plantilla de credenciales Firebase Web
│   └── README.md                     # Guía de instalación y desarrollo de la App
│
├── 📁 firmware/                      # ⚡ FIRMWARE MICROCONTROLADOR ESP32
│   ├── platformio.ini                # Configuración PlatformIO (Partición 1.9MB Flash)
│   ├── include/
│   │   ├── secrets.h.example         # Plantilla segura de credenciales WiFi y Firebase
│   │   └── secrets.h                 # Credenciales privadas locales (ignorado por Git)
│   ├── src/
│   │   └── main.cpp                  # Firmware C++ (FreeRTOS Dual-Core, Metrología RMS, OLED)
│   ├── lib/                          # Bibliotecas C++
│   ├── test/                         # Tests unitarios embebidos
│   └── README.md                     # Manual de cableado, pines y flasheo del ESP32
│
├── 📁 docs/                          # 📚 MANUALES TÉCNICOS Y ESQUEMÁTICOS
│   └── (Manual técnico ESP32, datasheets y notas de aplicación)
│
├── .gitignore                        # Reglas globales de exclusión para Git (seguridad de credenciales)
└── README.md                         # Portada principal del repositorio
```

---

## 🚀 Inicio Rápido

### 1. 📱 Para Desarrollar o Ejecutar la App Móvil / Web
```bash
# Entrar a la carpeta de la app
cd app

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

### 2. ⚡ Para Compilar o Flashear el Firmware ESP32
```bash
# Entrar a la carpeta del firmware
cd firmware

# Configurar credenciales
cp include/secrets.h.example include/secrets.h

# Compilar y subir al ESP32 por USB
pio run -t upload
```

---

## 🔒 Seguridad y Privacidad

- Las credenciales privadas de hardware (`secrets.h`) y las variables de entorno de la app (`.env`) están excluidas del control de versiones mediante `.gitignore` para evitar filtraciones accidentales al subir a GitHub.

---

## 👥 Desarrollado para
**Universidad Tecnológica La Salle (ULSA)** — Proyecto de Monitoreo y Gestión Energética Inteligente.

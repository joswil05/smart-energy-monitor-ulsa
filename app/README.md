# 📱 Smart Energy Monitor ULSA - Web & Mobile App

Aplicación cliente para la supervisión y control del consumo eléctrico en tiempo real, desarrollada con **React**, **Vite**, **Tailwind CSS**, **Framer Motion** y **Capacitor** para despliegue en Android.

---

## 🚀 Puesta en Marcha

### 1. Requisitos Previos
- **Node.js** (versión 18 o superior)
- **npm**

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Configuración de Firebase
Copia el archivo `.env.example` como `.env`:
```bash
cp .env.example .env
```
Verifica que las credenciales de tu proyecto de Firebase correspondan con tu consola de Firebase.

### 4. Servidor de Desarrollo Local (Web)
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 5. Compilación Móvil (Android con Capacitor)
Para sincronizar y abrir el proyecto en Android Studio:
```bash
npm run build
npx cap sync
npx cap open android
```

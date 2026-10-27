# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Responde siempre en español. El código, los comentarios, los logs serie y la interfaz de usuario están en español; mantén esa convención al escribir código nuevo.

## Qué es este repositorio

Monorepo de dos módulos **desacoplados** que nunca se importan entre sí. El único contrato que los une es el árbol JSON de **Firebase Realtime Database** bajo `system/`:

- `app/` — cliente React 19 + Vite 6 + Tailwind v4 + Capacitor (Android).
- `firmware/` — firmware C++ para ESP32 (Arduino + FreeRTOS dual-core) compilado con PlatformIO.
- `docs/` — PDFs de referencia (datasheets ESP32, manual PlatformIO). Solo lectura.

Cambiar la forma de un nodo bajo `system/` obliga a editar **ambos** módulos. Ese es el error más fácil de cometer aquí.

## Comandos

### App (`cd app`)

```bash
npm install
cp .env.example .env   # requerido: ya no hay credenciales de reserva en el codigo
npm run dev            # Vite en http://localhost:3000, expuesto en 0.0.0.0
npm run lint           # tsc --noEmit (única verificación estática; no hay ESLint)
npm run build          # vite build -> app/dist
npm run android:sync   # build + npx cap sync android
npm run android:open   # abre el proyecto en Android Studio
```

No hay suite de tests en la app. `npm run lint` es la única puerta de calidad automatizada.
`npm run build` cierra el ciclo: detecta lo que `tsc --noEmit` deja pasar.

### Firmware (`cd firmware`)

```bash
cp include/secrets.h.example include/secrets.h   # requerido antes de compilar
pio run                 # compilar
pio run -t upload       # compilar y flashear por USB
pio device monitor      # monitor serie a 115200 baudios
```

El cálculo de metrología sí tiene pruebas, y se ejecutan en el ordenador
porque son aritmética pura sin dependencia del ESP32:

```bash
cd firmware/test/test_metrology
./runtest.bat                                    # Windows, usa MSVC Build Tools
g++ -O2 -I../../src test_metrology.cpp ../../src/metrology.cpp -o t && ./t
```

Comprueban el factor de potencia contra cargas sintéticas resistiva, inductiva y
capacitiva, el rechazo del offset de continua y la ausencia de scalloping. Son
la única forma de validar el algoritmo sin el hardware delante. `pio test` no
ejecuta nada: no hay entorno `native` configurado.

`secrets.h` necesita ahora, además de las de WiFi y la URL de la base,
`FIREBASE_USER_EMAIL` y `FIREBASE_USER_PASSWORD`: son las de la cuenta de
servicio del dispositivo. Sin ellas el ESP32 no autentica y no publica nada.
La traza del token sale por el monitor serie, así que un fallo de credenciales
se ve en el arranque.

En Windows, si `pio` no está en el `PATH`, vive en
`~/.platformio/penv/Scripts/pio.exe`.

### Firebase (desde la raíz)

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only database   # publica firebase/database.rules.json
```

Comprobación de que la base quedó cerrada (debe responder **401**, no 200):

```bash
curl -s -o /dev/null -w "%{http_code}
"   "https://smart-energy-ulsa-default-rtdb.firebaseio.com/system.json"
```

## Contrato Firebase RTDB (`system/`)

Esta es la pieza que no se entiende leyendo un solo archivo. Productor y consumidor de cada nodo:

| Ruta | Escribe | Lee | Forma |
| :--- | :--- | :--- | :--- |
| `system/metrics` | ESP32 cada 2000 ms | App (`onValue`) | `{ v, i, p, q, s, pf, f, e, t, seq }` = voltaje, corriente, **potencia activa (W)**, reactiva (var), aparente (VA), factor de potencia medido, frecuencia (Hz), kWh, epoch en ms, contador |
| `system/health` | ESP32 cada 30 s | Nadie todavía | `{ rssi, up, heap, fw, resetReason, queueDrops }` |
| `system/devices/{1..4}/isOn` | Ambos | Ambos (ESP32 por **stream**, no por poll) | booleano por relé |
| `system/config/mode` | App | ESP32 (poll 1500 ms) | `normal`, `eco`, `night` o `away` |
| `system/config/*` (resto) | App | Solo la app | `powerLimit`, `tariffRate`, `currency`, `darkMode`, `pushNotifications` |
| `system/security/alert` | ESP32 | Nadie todavía | booleano de intrusión |
| `system/command/action` | App | ESP32 (poll 1500 ms) | `restart`; el ESP32 lo reescribe a `none` tras reiniciar |

Detalles con los que hay que tener cuidado:

- **Los IDs de dispositivo son `'1'` a `'4'` y están fijos en ambos lados.** En el firmware el índice del array `PINES_RELES[]` es `id - 1`. El relé 4 es la sirena.
- **`t` es epoch en milisegundos, sincronizado por SNTP.** El firmware ya lo publica y la app lo usa para la latencia real. Si el reloj aún no ha sincronizado, `t` sale desde 1970 y la app lo recorta al rango `[18, 250]` ms.
- **Solo `mode` viaja de `system/config` al hardware.** `powerLimit` y `tariffRate` son puramente del lado de la app. Reconciliarlo es la Fase 4 del plan.
- **`system/heartbeat` y `system/command/timestamp` ya no existen.** Se escribían y no los leía nadie; las reglas de la RTDB los rechazan ahora como claves desconocidas.
- **Las reglas validan tipo y rango de cada campo y rechazan claves desconocidas.** Ampliar el contrato obliga a tocar `firebase/database.rules.json` en la misma entrega, o la escritura se deniega.

### Autenticación (obligatoria)

La base **estaba abierta** a lectura y escritura sin autenticar. Ya no. Puesta en
marcha completa en `firebase/README.md`. En resumen:

- El ESP32 entra con una cuenta de servicio propia (correo y contraseña en
  `secrets.h`), no con el `signUp` anónimo de antes, que creaba un usuario nuevo
  en cada arranque.
- La app exige inicio de sesión (`app/src/hooks/useAuth.ts` + `views/LoginView.tsx`).
- **El acceso anónimo debe permanecer deshabilitado en la consola.** Habilitarlo
  anula las reglas en la práctica: la `apiKey` viaja en el bundle, así que
  cualquiera podría crearse una sesión anónima y pasar el `auth != null`.
- Las reglas distinguen al dispositivo por UID: solo él escribe `metrics`,
  `health` y `security/alert`; solo la app escribe `config`.

## Lógica de control duplicada a propósito

Los modos se aplican en dos lugares con reglas **distintas**, y es intencional (el ESP32 debe seguir protegiendo la carga sin red):

- **Firmware, `vControlTask`:** modo ECO desconecta el relé 3 por encima de 600 W (umbral fijo en el código). Modo NIGHT enciende el relé 1 con el PIR y lo apaga tras 30 s sin movimiento. Modo AWAY dispara la sirena por PIR o por consumo mayor a 15 W sin cargas intencionales.
- **App, `useEnergySystem`:** deslastre de carga (*load shedding*) contra el `powerLimit` configurable por el usuario, con prioridad de apagado `['3','1','2']` y cooldown de 2.5 s. Detección de intrusión en modo away por consumo mayor a 10 W, con notificación local limitada a una por minuto.

Si cambias un umbral, verifica si su gemelo del otro lado también debe moverse.

## Arquitectura del firmware (`firmware/src/main.cpp`, archivo único de ~500 líneas)

- **Core 1, `vControlTask` (prioridad 2, ciclo 100 ms):** muestreo RMS, integración de energía, lógica de modos, refresco OLED cada 10 ciclos.
- **Core 0, `vCloudSyncTask` (prioridad 1, ciclo 100 ms):** drena la cola de eventos, hace poll de config y comandos cada 600 ms, y publica telemetría cada 2000 ms.
- **Comunicación entre núcleos:** `g_systemState` protegido por `xStateMutex` (siempre vía `lockState()` / `unlockState()`), `xCloudEventQueue` para eventos salientes de Core 1 a Core 0, y `xRelayCommandQueue` para órdenes entrantes de Core 0 a Core 1. **Nunca toques `g_systemState` sin tomar el mutex, y nunca llames a Firebase desde Core 1.**
- **`applyRelay()` es la única función que escribe un GPIO de relé.** Solo se invoca desde Core 1. Core 0 encola en `xRelayCommandQueue` y no toca hardware. Antes ambos núcleos hacían `digitalWrite()` sin coordinación y Core 0 usaba `digitalRead()` como fuente de verdad paralela.
- **Si el mutex no se puede tomar, el ciclo de control se aborta entero** sin avanzar `lastTime` ni persistir. La versión anterior escribía `0.0` sobre el total histórico en Flash cuando eso pasaba.
- **Persistencia NVS:** doble copia alterna (`eA` / `eB`) con número de secuencia y CRC32, de modo que un corte de energía durante la escritura deja intacta la copia contraria. Se guarda con delta de 0.01 kWh, o tras 15 minutos **si hubo consumo**. Migra sola desde la clave `total` en `float` del esquema anterior.
- **La energía se acumula en `uint64_t` de microvatios-hora, no en `float`.** El `float` de 32 bits congelaba el contador: a 562 kWh medio ULP son 3.05e-5 kWh y el incremento a 190 W es 5.28e-6 kWh, así que cada suma redondeaba al mismo número. Se detectó congelado en producción.
- **Los relés entrantes llegan por stream, no por sondeo.** `fbdoStream` está en `/system/devices` y se drena con `readStream()` dentro de `vCloudSyncTask`. Solo `config/mode` y `command/action` se sondean, cada 1500 ms: se pasó de ~10 peticiones HTTPS/s a ~1.3.
- **`RELAY_ACTIVE_LEVEL` define la polaridad en un único sitio.** Muchos módulos de 4 relés optoacoplados son activo-bajo; si el tuyo lo es, cambia esa constante y nada más.
- **El relé 3 usa `GPIO 17`, no `GPIO 14`.** GPIO 14 es MTMS/HSPI-CLK y el bootloader lo agita al arrancar, lo que hacía chasquear el relé en cada reinicio.
- **Watchdog en dos niveles:** la tarea de control se registra en el TWDT hardware; la de red publica un latido (`g_cloudHeartbeat`) que la de control vigila, porque las llamadas TLS bloqueantes dispararían falsos positivos del TWDT.
- **La metrología está partida en dos y esa división es deliberada.** `src/metrology.cpp` es cálculo puro, sin Arduino ni ESP32, y por eso puede compilarse y probarse en el ordenador. `src/metrology_adc.cpp` es lo que sí depende del hardware: el muestreo. Mantén esa frontera; es lo que hace que el algoritmo sea verificable.
- **`p` es potencia ACTIVA, integrada como `(1/N)·Σ v[n]·i[n]`.** Antes era `v_rms · i_rms`, que es potencia aparente. Con una carga inductiva a 60 grados eso daba 1200 W donde hay 600 W. De ahí que el firmware antiguo publicara un `pf` fijo de 0.98: sin P real no hay factor de potencia que calcular.
- **La ventana de integración se recorta entre cruces por cero**, así que siempre contiene un número entero de ciclos de red. La ventana anterior era de 2,38 ciclos y producía error de scalloping.
- **El offset de continua se calcula como la media de la ventana**, no con una constante escrita a mano. Sin deriva térmica ni dependencia de la placa concreta.
- **El muestreo tiene su propia tarea** (`MeteringTask`, prioridad 3, Core 1). Antes gastaba 79 ms de cada ciclo de 100 ms de `vControlTask` en espera activa. Lo importante no es el rendimiento sino que la cadencia del bucle de control ya no entra en la exactitud de la medida. A cambio, el control queda desalojado durante cada ráfaga de unos 133 ms.
- **`USE_POT_SIMULATION`** vive ahora en `metrology_adc.cpp`, junto al muestreo. En modo simulación los potenciómetros no dan una onda sino continua, así que se **sintetiza** una senoidal de 60 Hz con esas amplitudes y se pasa por el mismo cálculo que en producción. El banco ejercita la ruta completa, factor de potencia incluido.
- **`V_SCALE_V_PER_MV` hay que calibrarlo en banco** contra un multímetro true-RMS: depende del potenciómetro de ganancia del módulo ZMPT101B, que es un ajuste manual irrepetible. `I_SCALE_A_PER_MV` sí es derivable (ACS712 de 20 A, 100 mV/A). Ese problema desaparece con la PCB propia, donde la ganancia la fija una resistencia al 0,1 %.
- El pinout completo está en `firmware/README.md`. Solo se usan pines ADC1 (34/35) porque ADC2 entra en conflicto con el WiFi.

## Arquitectura de la app (`app/src/`)

- **`hooks/useEnergySystem.ts` es el cerebro.** Concentra todos los listeners de Firebase, el estado del sistema, el watchdog de conexión (marca offline tras 5 s sin datos) y todos los escritores. Los componentes son presentacionales y reciben props; no llames a `firebase/database` desde una vista, salvo el reinicio del ESP32 que vive en `App.tsx`.
- **`App.tsx`** hace de shell: navegación por pestañas con estado local (`activeTab`, sin router), sidebar en `lg:` y dock inferior en móvil, más los modales globales.
- **`views/`** son las cuatro pestañas; **`components/`** son piezas reutilizables. El tipo `Device` se exporta desde `components/DeviceList.tsx` y `Mode` desde `components/SystemModes.tsx`.
- **`hooks/billing.ts`** implementa la tarifa escalonada Disnorte-Dissur de Nicaragua (cargo fijo 36.05 más 7 bloques, conversión a USD a 36.8 NIO). Una `tariffRate` personalizada mayor que 0 sustituye toda la escalera.
- **Modo oscuro:** clase `dark` en `<html>`, aplicada por un script inline en `index.html` antes de pintar (para evitar el parpadeo) y sincronizada después desde el hook. La preferencia vive a la vez en `localStorage` (`darkModePreference`) y en `system/config/darkMode`.
- **Tailwind v4** se carga vía el plugin de Vite `@tailwindcss/vite` y `@import "tailwindcss"` en `index.css`. No hay `tailwind.config.js`; la variante `dark` se define con `@custom-variant` en el CSS.

## Convenciones y trampas conocidas

- **Credenciales:** `app/.env` y `firmware/include/secrets.h` están en `.gitignore`. El fallback hardcodeado de `app/src/lib/firebase.ts` se retiró: ahora, si falta una variable `VITE_FIREBASE_*`, la app lanza un error al arrancar en vez de seguir con valores de reserva y enmascarar el problema. Copia `app/.env.example` a `app/.env`.
- **`base: './'` en `vite.config.ts` es obligatorio** para que el bundle funcione dentro del WebView de Capacitor. No lo cambies a `'/'`.
- El alias `@` apunta a la raíz de `app/`, no a `app/src/`.
- `package.json` arrastra dependencias del andamiaje original de AI Studio que **no se usan en ningún sitio**: `express`, `better-sqlite3`, `@google/genai`, `dotenv`, `tsx`. Lo mismo con `GEMINI_API_KEY` y `APP_URL` en `.env.example`.
- `index.html` inyecta manejadores `window.onerror` y `unhandledrejection` que pintan un banner rojo a pantalla completa. Es depuración para el WebView de Android, no un bug.
- El `appId` de Capacitor es `com.smarthome.energymonitor` y debe coincidir con el paquete Java de `android/app/src/main/java/com/smarthome/energymonitor/`.
- Tras cualquier cambio en `app/src` que deba verse en Android hay que ejecutar `npm run android:sync`; `npx cap open android` por sí solo no reconstruye nada.

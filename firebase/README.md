# Seguridad de la Realtime Database

## Por qué existe este directorio

Auditoría del 2026-08-21: la base de datos estaba **abierta a lectura y escritura sin
autenticar**. Una petición sin credenciales devolvía HTTP 200 sobre la raíz:

```bash
curl "https://smart-energy-ulsa-default-rtdb.firebaseio.com/system/config.json"
# -> 200 {"currency":"C$","darkMode":true,"mode":"away","powerLimit":650, ...}
```

Cualquiera con la URL podía disparar la sirena o cortar las luces.

Conviene aclarar un malentendido habitual: **la `apiKey` de Firebase para web no es un
secreto**. Google la documenta como pública, identifica el proyecto y no autoriza nada.
No hace falta rotarla. Lo que autoriza son las reglas, y eso es lo que arregla
`database.rules.json`.

## Modelo de permisos

| Ruta | Lee | Escribe |
| :--- | :--- | :--- |
| `system/**` | Cualquier usuario autenticado | segun la fila que corresponda |
| `system/metrics` | ídem | **solo el dispositivo** |
| `system/health` | ídem | **solo el dispositivo** |
| `system/security/alert` | ídem | **solo el dispositivo** |
| `system/config/*` | ídem | **solo la app** (el dispositivo no puede) |
| `system/devices/{1-4}/isOn` | ídem | ambos (la app manda, el dispositivo confirma) |
| `system/command/action` | ídem | ambos (la app pide, el dispositivo repone a `none`) |

Las reglas además **validan el tipo y el rango** de cada campo, y rechazan cualquier
clave desconocida mediante `$desconocido: { ".validate": false }`. Eso convierte el
contrato de `system/` en algo que la base impone, no en una convención que solo existe
en `CLAUDE.md`.

Dos rutas muertas quedan explícitamente prohibidas por esa validación:
`system/heartbeat` y `system/command/timestamp`. Se escribían y no las leía nadie.

## Puesta en marcha

### 1. Crear la cuenta del dispositivo

En la consola de Firebase, **Authentication → Sign-in method**, habilitar
**Correo electrónico/contraseña**. Después, en **Users → Add user**, crear:

```
correo:      device@smart-energy-ulsa.local
contraseña:  (generar una larga y aleatoria, guardarla)
```

Copiar el **UID** que aparece en la lista de usuarios.

### 2. Sustituir el marcador en las reglas

`database.rules.json` contiene tres veces la cadena `REEMPLAZAR_CON_UID_DEL_DISPOSITIVO`.
Sustituirla por el UID real:

```bash
sed -i 's/REEMPLAZAR_CON_UID_DEL_DISPOSITIVO/<UID_REAL>/g' firebase/database.rules.json
```

### 3. Desplegar

Con la CLI de Firebase (`npm i -g firebase-tools`), desde la raíz del repositorio:

```bash
firebase login
firebase deploy --only database
```

Sin la CLI: copiar el contenido de `database.rules.json` en
**Realtime Database → Reglas** en la consola y publicar.

### 4. Configurar el firmware

El ESP32 se autentica con ese mismo correo y contraseña. En `firmware/include/secrets.h`:

```cpp
#define FIREBASE_USER_EMAIL    "device@smart-energy-ulsa.local"
#define FIREBASE_USER_PASSWORD "la-contrasena-generada"
```

El firmware ya no usa `Firebase.signUp()`, que creaba un usuario anónimo distinto en
cada arranque.

### 5. Verificar que quedó cerrada

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://smart-energy-ulsa-default-rtdb.firebaseio.com/system.json"
```

Debe responder **401**. Si responde 200, las reglas no se desplegaron.

## Pendiente

El árbol `system/` crece en la Fase 7 del plan con `rules/`, `scenes/` y los campos
nuevos de `devices/`. Estas reglas cubren el contrato actual más los campos aditivos de
la Fase 1 (`t`, `seq`, `q`, `s`, `f`, `health`); hay que extenderlas en la misma entrega
que amplíe el contrato, porque `$desconocido` rechazará cualquier nodo que no esté aquí.

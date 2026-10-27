import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getDatabase } from "firebase/database";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";

// Ya no hay valores de reserva escritos en el código. El fallback anterior
// hacía que la app arrancara sin `.env`, lo que enmascaraba errores de
// configuración y dejaba las credenciales del proyecto en el repositorio.
// Que falte una variable ahora es un fallo ruidoso y temprano.
//
// Sobre la apiKey: no es un secreto. Google la documenta como pública, viaja
// en el bundle y solo identifica el proyecto. Lo que protege la base son las
// reglas de `firebase/database.rules.json`, no ocultar esta cadena.
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const faltantes = Object.entries(firebaseConfig)
  .filter(([, valor]) => !valor)
  .map(([clave]) => clave);

if (faltantes.length > 0) {
  throw new Error(
    `Configuración de Firebase incompleta. Sin valor: ${faltantes.join(", ")}. ` +
      `Copia app/.env.example a app/.env y complétalo.`
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getDatabase(app);
export const auth = getAuth(app);

// Sesión persistente entre recargas y dentro del WebView de Capacitor, para no
// pedir credenciales cada vez que se abre la app.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("[auth] No se pudo fijar la persistencia local:", error);
});

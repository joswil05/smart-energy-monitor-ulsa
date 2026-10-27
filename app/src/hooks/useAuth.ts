import { useCallback, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export type AuthStatus = 'cargando' | 'autenticado' | 'sin-sesion';

// Firebase devuelve códigos en inglés. La interfaz está en español y, sobre
// todo, conviene distinguir "credenciales mal puestas" de "el proveedor no
// está habilitado en la consola", que es el fallo más probable la primera vez.
function mensajeDeError(error: unknown): string {
    const codigo = (error as { code?: string })?.code ?? '';
    switch (codigo) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Correo o contraseña incorrectos.';
        case 'auth/invalid-email':
            return 'El correo no tiene un formato válido.';
        case 'auth/user-disabled':
            return 'Esta cuenta está deshabilitada.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos fallidos. Espera unos minutos.';
        case 'auth/network-request-failed':
            return 'Sin conexión con Firebase. Revisa la red.';
        case 'auth/operation-not-allowed':
            return 'El acceso con correo y contraseña no está habilitado en la consola de Firebase.';
        default:
            return 'No se pudo iniciar sesión. Revisa la consola para el detalle.';
    }
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [status, setStatus] = useState<AuthStatus>('cargando');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        return onAuthStateChanged(auth, (cuenta) => {
            setUser(cuenta);
            setStatus(cuenta ? 'autenticado' : 'sin-sesion');
        });
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        setIsSubmitting(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (e) {
            console.error('[auth] Fallo al iniciar sesión:', e);
            setError(mensajeDeError(e));
        } finally {
            setIsSubmitting(false);
        }
    }, []);

    const signOut = useCallback(async () => {
        setError(null);
        try {
            await firebaseSignOut(auth);
        } catch (e) {
            console.error('[auth] Fallo al cerrar sesión:', e);
        }
    }, []);

    return { user, status, error, isSubmitting, signIn, signOut };
}

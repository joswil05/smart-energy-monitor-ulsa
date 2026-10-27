import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, Mail, Loader2, AlertTriangle } from 'lucide-react';

interface LoginViewProps {
    onSignIn: (email: string, password: string) => void;
    error: string | null;
    isSubmitting: boolean;
}

export function LoginView({ onSignIn, error, isSubmitting }: LoginViewProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || isSubmitting) return;
        onSignIn(email, password);
    };

    const inputClass =
        'w-full rounded-2xl border border-slate-200 dark:border-[#1E293B] bg-slate-50 dark:bg-[#0B1220] ' +
        'py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 ' +
        'dark:placeholder:text-slate-500 transition-colors focus:border-blue-500 focus:outline-none';

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#070A11]">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="w-full max-w-sm bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/10"
            >
                <div className="flex flex-col items-center text-center mb-7">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
                        <Zap className="w-6 h-6 text-blue-500" />
                    </div>
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                        Smart Energy Monitor
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                        Inicia sesión para controlar el sistema.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Correo"
                            autoComplete="username"
                            aria-label="Correo"
                            className={inputClass}
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            autoComplete="current-password"
                            aria-label="Contraseña"
                            className={inputClass}
                        />
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3"
                        >
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 dark:text-red-400 text-left">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !email || !password}
                        className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <p className="mt-6 text-xs leading-relaxed text-slate-400 dark:text-slate-500 text-center">
                    Las cuentas se crean desde la consola de Firebase. El acceso anónimo
                    debe permanecer deshabilitado.
                </p>
            </motion.div>
        </div>
    );
}

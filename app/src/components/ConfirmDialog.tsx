import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Haptics } from '@capacitor/haptics';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#131B2F] border border-slate-200 dark:border-[#1E293B] rounded-3xl p-5 sm:p-6 shadow-2xl shadow-slate-950/20 text-left overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-2xl shrink-0",
                isDestructive
                  ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
              )}>
                <AlertTriangle size={24} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F1F5F9] tracking-tight">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
                  {description}
                </p>
              </div>
              <button
                onClick={onCancel}
                aria-label="Cerrar modal"
                className="absolute top-4 right-4 p-2 text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F1F5F9] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-[#334155] text-slate-700 dark:text-[#F1F5F9] hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm transition-[transform,background-color] duration-150 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try { await Haptics.vibrate({ duration: 20 }); } catch (e) {}
                  onConfirm();
                }}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl text-white font-semibold text-sm transition-[transform,background-color] duration-150 active:scale-95 cursor-pointer shadow-md focus-visible:ring-2",
                  isDestructive
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-900/20 focus-visible:ring-amber-500/40"
                    : "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20 focus-visible:ring-blue-500/40"
                )}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

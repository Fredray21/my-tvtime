import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { triggerVibration } from '../utils/haptics';

export interface ConfirmOptions {
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
    onConfirm: () => void;
    onCancel: () => void;
}

// Popup de confirmation pour les actions qui suppriment des données (feuille en bas sur mobile, centrée sur grand écran)
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    message,
    confirmLabel = 'Supprimer',
    cancelLabel = 'Annuler',
    onConfirm,
    onCancel,
}) => {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onCancel]);

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={onCancel}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl mb-16 sm:mb-0"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="min-w-0">
                        <h2 id="confirm-dialog-title" className="text-base font-bold text-white">{title}</h2>
                        <div className="text-sm text-zinc-400 mt-1 leading-relaxed">{message}</div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        autoFocus
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-zinc-800 text-white hover:bg-zinc-700 transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={() => {
                            triggerVibration([50, 80, 20]);
                            onConfirm();
                        }}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

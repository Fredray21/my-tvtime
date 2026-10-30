import { useMutationState } from '@tanstack/react-query';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from './network';

interface OfflineBannerProps {
    isOfflineMode?: boolean; // app ouverte sans Clerk (démarrage hors ligne)
}

// Bandeau discret : hors ligne / actions en attente / synchronisation en cours
export const OfflineBanner = ({ isOfflineMode = false }: OfflineBannerProps) => {
    const isOnline = useNetworkStatus();
    const pausedCount = useMutationState({ filters: { predicate: m => m.state.isPaused } }).length;
    const syncingCount = useMutationState({ filters: { status: 'pending', predicate: m => !m.state.isPaused } }).length;

    const pending = pausedCount > 0 && ` · ${pausedCount} action${pausedCount > 1 ? 's' : ''} en attente`;

    if (!isOnline || isOfflineMode) {
        return (
            <div className="sticky top-0 z-[60] bg-amber-500/15 border-b border-amber-500/30 backdrop-blur-md text-amber-300 text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2">
                <CloudOff size={14} className="flex-shrink-0" />
                <span>{isOnline ? 'Connexion impossible' : 'Hors ligne'}{pending}</span>
                {isOnline && (
                    <button onClick={() => window.location.reload()} className="ml-1 underline underline-offset-2 text-amber-200">
                        Réessayer
                    </button>
                )}
            </div>
        );
    }

    if (syncingCount > 0 || pausedCount > 0) {
        return (
            <div className="sticky top-0 z-[60] bg-purple-500/15 border-b border-purple-500/30 backdrop-blur-md text-purple-200 text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin flex-shrink-0" />
                <span>Synchronisation de tes actions…</span>
            </div>
        );
    }

    return null;
};

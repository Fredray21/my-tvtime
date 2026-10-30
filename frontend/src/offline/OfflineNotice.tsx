import { CloudOff } from 'lucide-react';

// Affiché à la place du chargement quand une page n'a jamais été ouverte sur cet appareil et qu'on est hors ligne
export const OfflineNotice = ({ what = 'Cette page' }: { what?: string }) => (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-8 text-center text-zinc-400">
        <CloudOff className="mb-3 text-zinc-600" size={32} />
        <p className="text-sm font-bold text-white mb-1">Pas disponible hors ligne</p>
        <p className="text-xs">{what} n'a pas encore été ouverte sur cet appareil. Elle sera disponible hors ligne après ta prochaine visite avec du réseau.</p>
    </div>
);

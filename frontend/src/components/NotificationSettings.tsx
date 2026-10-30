import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellOff, Loader, Send } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { triggerVibration } from '../utils/haptics';
import { disablePush, enablePush, getPushStatus, type PushStatus } from '../utils/pushNotifications';

const STATUS_HINTS: Partial<Record<PushStatus, string>> = {
    ios_install_required: "Sur iPhone, installe d'abord l'app : Partager → « Sur l'écran d'accueil », puis ouvre-la depuis l'icône.",
    unsupported: 'Ton navigateur ne prend pas en charge les notifications.',
    denied: 'Notifications bloquées : réautorise-les dans les réglages du navigateur pour ce site.',
    no_service_worker: "Disponible uniquement sur l'app installée ou en production.",
};

// Réglage des notifications push (nouveaux épisodes, sorties des films de la watchlist), par appareil
export const NotificationSettings = () => {
    const api = useApi();
    const [status, setStatus] = useState<PushStatus | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const { data: config } = useQuery({
        queryKey: ['pushConfig'],
        queryFn: () => api.user.getPushConfig(),
        staleTime: Infinity,
    });

    useEffect(() => {
        getPushStatus().then(setStatus);
    }, []);

    // Serveur sans clés VAPID : on n'affiche rien plutôt qu'un bouton qui ne marcherait pas
    if (!config?.enabled || status === null) return null;

    const isEnabled = status === 'enabled';
    const canToggle = status === 'enabled' || status === 'disabled';

    const toggle = async () => {
        setIsWorking(true);
        setMessage(null);
        triggerVibration([15, 30]);
        try {
            if (isEnabled) {
                await disablePush(api.user);
            } else {
                await enablePush(api.user);
            }
        } catch (err) {
            setMessage((err as Error).message);
        } finally {
            setStatus(await getPushStatus());
            setIsWorking(false);
        }
    };

    const sendTest = async () => {
        setIsWorking(true);
        setMessage(null);
        try {
            const { sent } = await api.user.sendTestPush();
            setMessage(sent > 0 ? 'Notification de test envoyée !' : "Aucun appareil n'a reçu la notification.");
        } catch {
            setMessage("Échec de l'envoi du test.");
        } finally {
            setIsWorking(false);
        }
    };

    return (
        <div className="mb-6 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    {isEnabled ? <Bell size={22} /> : <BellOff size={22} />}
                </div>
                <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-white">Notifications</p>
                    <p className="text-xs text-zinc-400">Nouveaux épisodes et sorties de ta watchlist</p>
                </div>
                {canToggle && (
                    <button
                        onClick={toggle}
                        disabled={isWorking}
                        role="switch"
                        aria-checked={isEnabled}
                        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${isEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all flex items-center justify-center ${isEnabled ? 'left-6' : 'left-1'}`}>
                            {isWorking && <Loader size={12} className="animate-spin text-zinc-500" />}
                        </span>
                    </button>
                )}
            </div>

            {STATUS_HINTS[status] && <p className="text-xs text-amber-400/90 mt-3">{STATUS_HINTS[status]}</p>}

            {isEnabled && (
                <button
                    onClick={sendTest}
                    disabled={isWorking}
                    className="mt-3 w-full py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Send size={14} /> Envoyer une notification de test
                </button>
            )}

            {message && <p className="text-xs text-zinc-400 mt-2 text-center">{message}</p>}
        </div>
    );
};

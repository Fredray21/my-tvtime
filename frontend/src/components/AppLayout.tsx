import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useApi } from '../context/ApiContext';
import { syncPushSubscription } from '../utils/pushNotifications';
import { OfflineBanner } from '../offline/OfflineBanner';

interface AppLayoutProps {
    isOfflineMode?: boolean;
}

export const AppLayout = ({ isOfflineMode = false }: AppLayoutProps) => {
    const api = useApi();

    // À l'ouverture : réabonnement silencieux aux notifications si besoin (clés changées, abonnement expiré)
    useEffect(() => {
        if (!isOfflineMode) syncPushSubscription(api.user);
    }, [api, isOfflineMode]);

    return (
        <div className="min-h-screen bg-zinc-950">
            <OfflineBanner isOfflineMode={isOfflineMode} />

            <main>
                <Outlet />
            </main>

            <BottomNav />
        </div>
    );
};

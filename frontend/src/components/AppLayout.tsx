import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useApi } from '../context/ApiContext';
import { syncPushSubscription } from '../utils/pushNotifications';

export const AppLayout = () => {
    const api = useApi();

    // À l'ouverture : réabonnement silencieux aux notifications si besoin (clés changées, abonnement expiré)
    useEffect(() => {
        syncPushSubscription(api.user);
    }, [api]);

    return (
        <div className="min-h-screen bg-zinc-950">
            <main>
                <Outlet />
            </main>

            <BottomNav />
        </div>
    );
};

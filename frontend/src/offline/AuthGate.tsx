import { useEffect, useState } from 'react';
import { SignIn, useAuth, useUser } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { AppLayout } from '../components/AppLayout';
import { clearOfflineData, readOfflineSession, saveOfflineSession } from './persistence';
import { setAuthReady, useNetworkStatus } from './network';

// Au-delà, on considère que Clerk ne répondra pas (réseau trop faible) et on ouvre l'app avec le cache
const CLERK_TIMEOUT = 4000;

// Remplace <SignedIn>/<SignedOut> : en plus du cas normal, ouvre l'app hors ligne
// si un utilisateur était déjà connecté sur cet appareil (Clerk ne peut pas démarrer sans réseau)
export const AuthGate = () => {
    const { isLoaded, isSignedIn } = useAuth();
    const { user } = useUser();
    const queryClient = useQueryClient();
    const isOnline = useNetworkStatus();
    const [offlineSession] = useState(readOfflineSession);
    const [clerkTimedOut, setClerkTimedOut] = useState(false);

    useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => setClerkTimedOut(true), CLERK_TIMEOUT);
        return () => clearTimeout(timer);
    }, [isLoaded]);

    // L'API n'est joignable qu'une fois connecté via Clerk
    useEffect(() => {
        setAuthReady(isLoaded && !!isSignedIn);
    }, [isLoaded, isSignedIn]);

    // On garde de quoi afficher le profil hors ligne
    useEffect(() => {
        if (!isSignedIn || !user) return;
        saveOfflineSession({
            fullName: user.fullName,
            email: user.primaryEmailAddress?.emailAddress ?? null,
            imageUrl: user.imageUrl,
        });
    }, [isSignedIn, user]);

    // Déconnecté : plus aucune donnée personnelle ne reste sur l'appareil
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            queryClient.clear();
            clearOfflineData();
        }
    }, [isLoaded, isSignedIn, queryClient]);

    const isOfflineMode = !isLoaded && !!offlineSession && (!isOnline || clerkTimedOut);

    // Retour du réseau alors que Clerk n'a pas pu démarrer : on relance l'app pour se reconnecter
    // (les actions en attente sont sauvegardées sur l'appareil et repartiront après le rechargement)
    useEffect(() => {
        if (!isOfflineMode) return;
        const onOnline = () => setTimeout(() => window.location.reload(), 1500);
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [isOfflineMode]);

    if (isLoaded) {
        return isSignedIn ? <AppLayout /> : (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                {isOnline ? <SignIn routing="hash" /> : <OfflineSignInNotice />}
            </div>
        );
    }

    if (isOfflineMode) return <AppLayout isOfflineMode />;

    if (!isOnline) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
                <OfflineSignInNotice />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
    );
};

const OfflineSignInNotice = () => (
    <div className="max-w-xs text-center text-zinc-400">
        <WifiOff className="mx-auto mb-3 text-zinc-600" size={32} />
        <p className="text-sm font-bold text-white mb-1">Tu es hors ligne</p>
        <p className="text-xs">Connecte-toi une première fois avec du réseau pour pouvoir utiliser l'app hors ligne ensuite.</p>
    </div>
);

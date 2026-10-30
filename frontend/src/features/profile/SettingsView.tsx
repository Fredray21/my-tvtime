import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { ChevronRight, FileUp, LogOut, UserPen } from 'lucide-react';
import { triggerVibration } from '../../utils/haptics';
import { TVTimeImport } from '../../components/TVTimeImport';
import { NotificationSettings } from '../../components/NotificationSettings';

// Réglages rarement utilisés, sortis du profil pour l'alléger
export const SettingsView = () => {
    const navigate = useNavigate();
    const { signOut, openUserProfile } = useClerk();
    const [isImportOpen, setIsImportOpen] = useState(false);

    const rowClass = 'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-800/50 transition-colors';

    return (
        <div className="min-h-screen bg-zinc-950 text-white px-4 pt-6 pb-24">
            <div className="max-w-md mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <button
                        onClick={() => {
                            triggerVibration();
                            navigate(-1);
                        }}
                        className="bg-zinc-900 border border-zinc-800 p-2 rounded-full text-zinc-300 hover:text-white transition aspect-square"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
                </div>

                {/* COMPTE & DONNÉES */}
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Compte</h2>
                <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden divide-y divide-zinc-800">
                    <button onClick={() => openUserProfile()} className={rowClass}>
                        <UserPen size={20} className="text-zinc-400" />
                        <span className="flex-grow text-sm font-medium">Modifier mon profil</span>
                        <ChevronRight size={18} className="text-zinc-600" />
                    </button>
                    <button
                        onClick={() => {
                            triggerVibration([15, 30]);
                            setIsImportOpen(true);
                        }}
                        className={rowClass}
                    >
                        <FileUp size={20} className="text-zinc-400" />
                        <span className="flex-grow text-sm font-medium">Importer depuis TV Time</span>
                        <ChevronRight size={18} className="text-zinc-600" />
                    </button>
                </div>

                {/* NOTIFICATIONS (masqué si le serveur n'a pas les clés VAPID) */}
                <NotificationSettings />

                <button
                    onClick={() => {
                        triggerVibration([30, 100, 30]);
                        signOut();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500/20 transition-colors active:scale-[0.98]"
                >
                    <LogOut size={18} /> Se déconnecter
                </button>
            </div>

            {/* MODALE D'IMPORT */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl w-full max-w-2xl relative shadow-2xl animate-fade-in">
                        <button
                            onClick={() => {
                                triggerVibration([15]);
                                setIsImportOpen(false);
                            }}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-900 transition-colors z-10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <TVTimeImport />
                    </div>
                </div>
            )}
        </div>
    );
};

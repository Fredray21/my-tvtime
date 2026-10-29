import { useEffect, useState } from 'react';
import { Download, Loader, Share2, X } from 'lucide-react';
import { triggerVibration } from '../../utils/haptics';
import type { WrappedResponse } from '../../api/userApi';
import { generateWrappedImage, WRAPPED_THEMES } from './wrappedImage';

interface ShareWrappedModalProps {
    wrapped: WrappedResponse;
    onClose: () => void;
}

export const ShareWrappedModal = ({ wrapped, onClose }: ShareWrappedModalProps) => {
    const [themeId, setThemeId] = useState(WRAPPED_THEMES[0].id);
    // Résultat de la dernière génération, rattaché au thème pour lequel elle a été faite
    const [result, setResult] = useState<{ themeId: string; blob?: Blob; url?: string; error?: string } | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    // (Re)génère l'image à l'ouverture et à chaque changement de thème
    useEffect(() => {
        let cancelled = false;
        let createdUrl: string | null = null;
        const theme = WRAPPED_THEMES.find(t => t.id === themeId) ?? WRAPPED_THEMES[0];

        generateWrappedImage(wrapped, theme)
            .then(blob => {
                if (cancelled) return;
                createdUrl = URL.createObjectURL(blob);
                setResult({ themeId, blob, url: createdUrl });
            })
            .catch(err => {
                console.error('Génération du Wrapped :', err);
                if (!cancelled) setResult({ themeId, error: "Impossible de générer l'image." });
            });

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [wrapped, themeId]);

    // Tant que le nouveau thème n'est pas prêt, on affiche le chargement
    const current = result?.themeId === themeId ? result : null;
    const image = current?.blob && current.url ? { blob: current.blob, url: current.url } : null;
    const error = current?.error ?? null;

    const fileName = `my-tvtime-wrapped-${wrapped.year}.png`;

    const download = () => {
        if (!image) return;
        const link = document.createElement('a');
        link.href = image.url;
        link.download = fileName;
        link.click();
    };

    const share = async () => {
        if (!image) return;
        triggerVibration([20, 80, 20]);
        const file = new File([image.blob], fileName, { type: 'image/png' });

        // Partage natif (mobile) si dispo, sinon téléchargement
        if (navigator.canShare?.({ files: [file] })) {
            setIsSharing(true);
            try {
                await navigator.share({ files: [file], title: `Mon année ${wrapped.year} sur My TV Time` });
            } catch (err) {
                // L'utilisateur a fermé la feuille de partage : rien à faire
                if ((err as Error).name !== 'AbortError') download();
            } finally {
                setIsSharing(false);
            }
        } else {
            download();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                <div className="w-full flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Partager mon année</h2>
                    <button onClick={onClose} className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Aperçu au format story (9:16) */}
                <div className="w-full max-h-[60vh] aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    {image ? (
                        <img src={image.url} alt={`Wrapped ${wrapped.year}`} className="w-full h-full object-contain" />
                    ) : error ? (
                        <p className="text-red-400 text-sm px-6 text-center">{error}</p>
                    ) : (
                        <Loader className="text-purple-500 animate-spin" size={28} />
                    )}
                </div>

                {/* Choix du thème */}
                <div className="flex gap-3">
                    {WRAPPED_THEMES.map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => {
                                triggerVibration(10);
                                setThemeId(theme.id);
                            }}
                            title={theme.label}
                            className={`w-9 h-9 rounded-full border-2 transition-all ${themeId === theme.id ? 'border-white scale-110' : 'border-transparent opacity-70'}`}
                            style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.via})` }}
                        />
                    ))}
                </div>

                <div className="w-full flex gap-3">
                    <button
                        onClick={download}
                        disabled={!image}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-zinc-800 text-white hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                        <Download size={16} /> Télécharger
                    </button>
                    <button
                        onClick={share}
                        disabled={!image || isSharing}
                        className="flex-[2] py-3 rounded-xl font-bold text-sm bg-purple-500 text-black hover:bg-purple-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                        {isSharing ? <Loader size={16} className="animate-spin" /> : <Share2 size={16} />} Partager
                    </button>
                </div>
            </div>
        </div>
    );
};

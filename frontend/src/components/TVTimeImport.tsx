import React, { useState, useRef, useEffect } from 'react';
import { useApi } from '../context/ApiContext';
import { Upload, Loader2, CheckCircle2, AlertTriangle, Film, Tv, ArrowRight } from 'lucide-react';

// --- Types adaptés ---
interface WatchedEpisode {
    season: number;
    episode: number;
    rewatch_count: number;
    watched_at: string;
}

interface TVImportItem {
    title: string;
    tmdb_id: number;
    episodes: WatchedEpisode[];
}

interface MovieImportItem {
    title: string;
    tmdb_id: number;
    watched_at: string;
}

export interface ImportAnalysisResponse {
    movies: {
        to_import: MovieImportItem[];
        not_found: string[];
    };
    tv: {
        to_import: TVImportItem[];
        not_found: string[];
    };
}

interface TaskStatus {
    id: string;
    state: 'processing' | 'completed' | 'failed';
    progress: string; // Message global actuel
    percent_tv: number;
    percent_movies: number;
    result?: ImportAnalysisResponse;
    error?: string;
}

export const TVTimeImport: React.FC = () => {
    const api = useApi();
    const [dragActive, setDragActive] = useState(false);
    const [step, setStep] = useState<'idle' | 'syncing' | 'summary'>('idle');
    const [progressText, setProgressText] = useState('Démarrage de l\'analyse...');
    const [percentTv, setPercentTv] = useState(0);
    const [percentMovies, setPercentMovies] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<ImportAnalysisResponse | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, []);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = async (file: File) => {
        if (!file.name.endsWith('.zip')) {
            setError("Veuillez déposer un fichier d'export au format .zip uniquement.");
            return;
        }

        setError(null);
        setStep('syncing');
        setPercentTv(0);
        setPercentMovies(0);
        setProgressText("Lecture de l'archive TV Time...");

        try {
            const data = await api.user.analyzeTVTime(file);
            startPolling(data.task_id);
        } catch (err: any) {
            setError(err.response?.data?.error || "Une erreur est survenue lors de l'upload.");
            setStep('idle');
        }
    };

    const startPolling = (taskId: string) => {
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const status: TaskStatus = await api.user.getImportStatus(taskId);

                if (status.state === "processing") {
                    setPercentTv(status.percent_tv || 0);
                    setPercentMovies(status.percent_movies || 0);
                    setProgressText(status.progress);
                } else if (status.state === "completed") {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setAnalysis(status.result || null);
                    setStep('summary');
                } else if (status.state === "failed") {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setError(status.error || "L'analyse a échoué.");
                    setStep('idle');
                }
            } catch (err: any) {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setError(err.response?.data?.error || "Erreur de suivi de l'importation.");
                setStep('idle');
            }
        }, 1000);
    };


    const handleConfirmImport = async () => {
        if (!analysis) return;

        setIsSaving(true);
        setError(null);

        setPercentTv(0);
        setPercentMovies(0);
        setProgressText("Initialisation de la base de données...");
        setStep('syncing');

        try {
            const data = await api.user.confirmTVTimeImport(analysis);

            if (data.task_id) {
                startWritePolling(data.task_id);
            } else {
                throw new Error("Aucun ID de tâche retourné par le serveur.");
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Erreur au démarrage de la sauvegarde.");
            setStep('summary');
            setIsSaving(false);
        }
    };

    const startWritePolling = (taskId: string) => {
        // On s'assure qu'aucun autre intervalle ne tourne
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const status = await api.user.getImportStatus(taskId);

                if (status.state === "processing") {
                    setPercentTv(status.percent_tv || 0);
                    setPercentMovies(status.percent_movies || 0);
                    setProgressText(status.progress);
                } else if (status.state === "completed") {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setImportSuccess(true);
                    setStep('summary');
                    setIsSaving(false);
                } else if (status.state === "failed") {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setError(status.error || "La sauvegarde a échoué en base de données.");
                    setStep('summary');
                    setIsSaving(false);
                }
            } catch (err: any) {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setError(err.response?.data?.error || "Erreur de connexion pendant le suivi de l'écriture.");
                setStep('summary');
                setIsSaving(false);
            }
        }, 1000); // Polling toutes les secondes
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 text-white">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-extrabold tracking-tight">Import TV Time</h1>
                <p className="text-zinc-400 mt-2 text-sm">Migrez proprement votre historique sans doublons.</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* --- ÉTAPE 1 : DRAG & DROP --- */}
            {step === 'idle' && (
                <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer min-h-[300px] ${dragActive
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
                        }`}
                >
                    <input ref={fileInputRef} type="file" className="hidden" accept=".zip" onChange={handleFileInput} />
                    <div className="p-4 bg-zinc-800/80 rounded-2xl text-purple-400 mb-4">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold">Glissez-déposez votre archive ZIP</h3>
                    <p className="text-sm text-zinc-500 mt-2 text-center max-w-xs">
                        Déposez votre archive TV Time pour démarrer l'analyse de vos séries et films.
                    </p>
                </div>
            )}

            {/* --- ÉTAPE 2 : DOUBLE BARRE DE PROGRESSION --- */}
            {step === 'syncing' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[300px]">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-6" />
                    <h3 className="text-xl font-bold mb-1">
                        {isSaving ? "Enregistrement en base de données" : "Analyse de vos fichiers"}
                    </h3>

                    <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider mb-8">{progressText}</p>

                    <div className="w-full max-w-md space-y-6">
                        {/* Barre Séries */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-zinc-400">
                                <span className="flex items-center gap-1.5"><Tv className="w-3.5 h-3.5" /> Synchronisation des séries</span>
                                <span>{percentTv}%</span>
                            </div>
                            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${percentTv}%` }} />
                            </div>
                        </div>

                        {/* Barre Films */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-zinc-400">
                                <span className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5" /> Synchronisation des films</span>
                                <span>{percentMovies}%</span>
                            </div>
                            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${percentMovies}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ÉTAPE 3 : RÉSUMÉ DÉTAILLÉ (Séries + Films) --- */}
            {step === 'summary' && analysis && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                            <div className="flex items-center gap-3 mb-2">
                                <Tv className="w-5 h-5 text-blue-400" />
                                <h3 className="font-bold text-lg">Séries</h3>
                            </div>
                            <p className="text-3xl font-black text-blue-400">{analysis.tv.to_import?.length || 0}</p>

                            {/*Mise à jour du texte selon le succès */}
                            <p className="text-xs text-zinc-500 mt-1">
                                {importSuccess ? "Séries historiques importées" : "Séries uniques avec épisodes vus"}
                            </p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                            <div className="flex items-center gap-3 mb-2">
                                <Film className="w-5 h-5 text-green-400" />
                                <h3 className="font-bold text-lg">Films</h3>
                            </div>
                            <p className="text-3xl font-black text-green-400">{analysis.movies.to_import?.length || 0}</p>

                            {/*Mise à jour du texte selon le succès */}
                            <p className="text-xs text-zinc-500 mt-1">
                                {importSuccess ? "Films historiques importés" : "Films vus (sans doublons)"}
                            </p>
                        </div>
                    </div>

                    {/* Listes détaillées */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            {/*Changement du titre du panneau */}
                            <h3 className="font-bold text-lg">
                                {importSuccess ? "Éléments ajoutés à votre profil 🎉" : "Éléments prêts à être importés"}
                            </h3>
                        </div>

                        <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto divide-y divide-zinc-800/40">
                            {/* Non trouvés */}
                            {((analysis.tv.not_found?.length || 0) > 0 || (analysis.movies.not_found?.length || 0) > 0) && (
                                <div className="space-y-4 pb-4">
                                    <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-400" /> Non trouvés
                                    </h4>
                                    <div className="flex flex-wrap gap-2 pl-2">
                                        {(analysis.tv.not_found || []).map((name, i) => (
                                            <span key={`tv-nf-${i}`} className="bg-red-500/5 border border-red-500/10 text-red-400/80 text-xs px-2.5 py-1 rounded-full">
                                                📺 {name}
                                            </span>
                                        ))}
                                        {(analysis.movies.not_found || []).map((name, i) => (
                                            <span key={`movie-nf-${i}`} className="bg-red-500/5 border border-red-500/10 text-red-400/80 text-xs px-2.5 py-1 rounded-full">
                                                🎬 {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Séries prêtes à importer */}
                            {(analysis.tv.to_import?.length || 0) > 0 && (
                                <div className="space-y-3 pb-4">
                                    <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-blue-400" /> Séries ({analysis.tv.to_import.length})
                                    </h4>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                                        {/*Sécurisation du map avec fallback || [] */}
                                        {(analysis.tv.to_import || []).map((item, i) => (
                                            <li key={i} className="text-sm flex justify-between bg-zinc-950/40 px-3 py-2 rounded-xl border border-zinc-800/50">
                                                <span className="font-medium text-zinc-200 truncate pr-2">{item.title}</span>
                                                <span className="text-zinc-500 shrink-0 text-xs">{item.episodes?.length || 0} éps</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Films prêts à importer */}
                            {(analysis.movies.to_import?.length || 0) > 0 && (
                                <div className="space-y-3 pt-4">
                                    <h4 className="text-sm font-bold text-green-400 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-400" /> Films ({analysis.movies.to_import.length})
                                    </h4>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                                        {/*Sécurisation du map */}
                                        {(analysis.movies.to_import || []).map((item, i) => (
                                            <li key={i} className="text-sm flex justify-between bg-zinc-950/40 px-3 py-2 rounded-xl border border-zinc-800/50">
                                                <span className="font-medium text-zinc-200 truncate pr-2">{item.title}</span>
                                                <span className="text-zinc-500 shrink-0 text-xs">
                                                    {new Date(item.watched_at).toLocaleDateString('fr-FR')}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3">
                            {importSuccess ? (
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg transition-all"
                                >
                                    Génial, voir mon profil mis à jour !
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setStep('idle')}
                                        disabled={isSaving}
                                        className="px-5 py-2.5 rounded-xl text-zinc-400 font-bold text-sm hover:bg-zinc-900 disabled:opacity-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleConfirmImport}
                                        disabled={isSaving}
                                        className="px-6 py-2.5 bg-purple-500 hover:bg-purple-400 text-black font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50 min-w-[150px] justify-center"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...
                                            </>
                                        ) : (
                                            <>
                                                Confirmer l'importation <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
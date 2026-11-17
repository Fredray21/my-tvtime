import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, Upload, Loader, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { triggerVibration } from '../utils/haptics';
import { ConfirmDialog } from './ConfirmDialog';
import type { BackupImportResult } from '../api/userApi';

type Status =
    | { kind: 'idle' }
    | { kind: 'busy'; label: string }
    | { kind: 'done'; result: BackupImportResult }
    | { kind: 'error'; message: string };

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Sauvegarde : export de toutes mes données en JSON, et réimport de ce fichier (même compte, autre compte ou autre instance)
export const BackupSettings = () => {
    const api = useApi();
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    const busy = status.kind === 'busy';
    const rowClass = 'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-zinc-800/50 transition-colors disabled:opacity-50';

    const handleExport = async () => {
        triggerVibration([15, 30]);
        setStatus({ kind: 'busy', label: 'Préparation de la sauvegarde...' });
        try {
            const blob = await api.user.exportBackup();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `my-tvtime-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            setStatus({ kind: 'idle' });
        } catch {
            setStatus({ kind: 'error', message: "L'export a échoué. Réessaie dans un instant." });
        }
    };

    const handleImport = async (file: File) => {
        setPendingFile(null);
        setStatus({ kind: 'busy', label: 'Import en cours...' });
        try {
            const result = await api.user.importBackup(file);
            triggerVibration([12, 30, 12]);
            setStatus({ kind: 'done', result });
            // Tout peut avoir changé : listes, notes, plateformes, stats
            queryClient.invalidateQueries();
        } catch (error) {
            const message = isAxiosError(error) && typeof error.response?.data?.error === 'string'
                ? error.response.data.error
                : "L'import a échoué, rien n'a été modifié.";
            setStatus({ kind: 'error', message });
        }
    };

    return (
        <>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">Sauvegarde</h2>
            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="divide-y divide-zinc-800">
                    <button onClick={handleExport} disabled={busy} className={rowClass}>
                        <Download size={20} className="text-zinc-400" />
                        <span className="flex-grow">
                            <span className="block text-sm font-medium">Exporter mes données</span>
                            <span className="block text-xs text-zinc-500">Films, séries, épisodes vus, notes et plateformes</span>
                        </span>
                    </button>
                    <button onClick={() => inputRef.current?.click()} disabled={busy} className={rowClass}>
                        <Upload size={20} className="text-zinc-400" />
                        <span className="flex-grow">
                            <span className="block text-sm font-medium">Importer une sauvegarde</span>
                            <span className="block text-xs text-zinc-500">Fichier exporté depuis My TvTime (.json)</span>
                        </span>
                    </button>
                </div>

                {status.kind !== 'idle' && (
                    <div className="flex items-start gap-2 px-4 py-3 border-t border-zinc-800 text-xs" role="status">
                        {status.kind === 'busy' && <><Loader size={14} className="animate-spin text-purple-400 mt-px" /><span className="text-zinc-300">{status.label}</span></>}
                        {status.kind === 'done' && (
                            <>
                                <CheckCircle2 size={14} className="text-emerald-400 mt-px flex-shrink-0" />
                                <span className="text-zinc-300">
                                    Import terminé : {plural(status.result.movies, 'film')}, {plural(status.result.series, 'série')},{' '}
                                    {plural(status.result.episodes, 'épisode')}, {plural(status.result.platforms, 'plateforme')}.
                                </span>
                            </>
                        )}
                        {status.kind === 'error' && <><AlertCircle size={14} className="text-red-400 mt-px flex-shrink-0" /><span className="text-red-300">{status.message}</span></>}
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) setPendingFile(file);
                    }}
                />
            </div>

            {pendingFile && (
                <ConfirmDialog
                    title="Importer cette sauvegarde ?"
                    message={
                        <>
                            <span className="block mb-2 text-zinc-300 font-medium break-all">{pendingFile.name}</span>
                            Le contenu est ajouté à tes données actuelles, rien n'est supprimé. Un titre déjà vu le reste, et tes notes actuelles ne sont remplacées que par celles du fichier.
                        </>
                    }
                    confirmLabel="Importer"
                    onConfirm={() => handleImport(pendingFile)}
                    onCancel={() => setPendingFile(null)}
                />
            )}
        </>
    );
};

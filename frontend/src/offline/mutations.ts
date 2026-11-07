import type { QueryClient } from '@tanstack/react-query';
import type { createMediaApi, UpdateStatusDTO } from '../api/mediaApi';

type MediaApi = ReturnType<typeof createMediaApi>;

// Actions utilisables hors ligne : mises en file d'attente (et sauvegardées sur l'appareil) tant qu'il n'y a pas de réseau,
// puis envoyées dans l'ordre au retour de la connexion, même après un redémarrage de l'app.
// Leur mutationFn est déclarée ici (setMutationDefaults) et non dans les composants, pour pouvoir être rejouée sans eux.

export const EPISODE_MUTATION_KEY = ['offline', 'episode'] as const;
export const MEDIA_MUTATION_KEY = ['offline', 'media'] as const;

export interface EpisodeMutationVars {
    seriesId: number;
    seasonNumber: number;
    episodeNumber?: number; // absent pour "watchSeason"
    action: 'watch' | 'remove' | 'decrement' | 'watchSeason';
}

export type MediaMutationVars =
    | { kind: 'status'; dto: UpdateStatusDTO }
    | { kind: 'remove'; tmdbId: number; mediaType: 'movie' | 'tv' }
    | { kind: 'notifications'; tmdbId: number; enabled: boolean };

const mutationMediaType = (vars: MediaMutationVars): 'movie' | 'tv' => {
    if (vars.kind === 'status') return vars.dto.media_type;
    if (vars.kind === 'remove') return vars.mediaType;
    return 'tv';
};

const mutationTmdbId = (vars: MediaMutationVars) => (vars.kind === 'status' ? vars.dto.tmdb_id : vars.tmdbId);

export const registerOfflineMutations = (queryClient: QueryClient, media: MediaApi) => {
    // scope : les actions d'un même type sont envoyées l'une après l'autre, dans l'ordre
    // (ex : "vu" puis "Annuler" depuis le toast ne doivent pas se croiser sur le réseau)
    queryClient.setMutationDefaults(EPISODE_MUTATION_KEY, {
        scope: { id: 'offline-episode' },
        mutationFn: (vars: EpisodeMutationVars) => {
            const { seriesId, seasonNumber, episodeNumber = 0 } = vars;
            switch (vars.action) {
                case 'watchSeason': return media.watchAllEpisodesInSeason(seriesId, seasonNumber);
                case 'remove': return media.removeEpisode(seriesId, seasonNumber, episodeNumber);
                case 'decrement': return media.decrementEpisode(seriesId, seasonNumber, episodeNumber);
                default: return media.watchEpisode(seriesId, seasonNumber, episodeNumber);
            }
        },
        // Une fois envoyée, on recharge les données concernées depuis le serveur (qui remplacent l'affichage optimiste)
        onSettled: (_data: unknown, _error: unknown, vars: EpisodeMutationVars) => {
            queryClient.invalidateQueries({ queryKey: ['tv', vars.seriesId] });
            queryClient.invalidateQueries({ queryKey: ['watchlist', 'tv'] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            queryClient.invalidateQueries({ queryKey: ['latestMedias', 'tv'] });
            queryClient.invalidateQueries({ queryKey: ['userStats'] });
        },
    });

    queryClient.setMutationDefaults(MEDIA_MUTATION_KEY, {
        scope: { id: 'offline-media' },
        mutationFn: (vars: MediaMutationVars) => {
            switch (vars.kind) {
                case 'remove': return media.removeMedia(vars.tmdbId, vars.mediaType);
                case 'notifications': return media.setSeriesNotifications(vars.tmdbId, vars.enabled);
                default: return media.updateStatus(vars.dto);
            }
        },
        onSettled: (_data: unknown, _error: unknown, vars: MediaMutationVars) => {
            const mediaType = mutationMediaType(vars);
            const tmdbId = mutationTmdbId(vars);
            if (vars.kind === 'notifications') {
                // Seule la fiche de la série affiche la cloche
                queryClient.invalidateQueries({ queryKey: ['tv', tmdbId] });
                return;
            }
            queryClient.invalidateQueries({ queryKey: mediaType === 'movie' ? ['movie', 'movie', tmdbId] : ['tv', tmdbId] });
            queryClient.invalidateQueries({ queryKey: ['watchlist', mediaType] });
            queryClient.invalidateQueries({ queryKey: ['favorites', mediaType] });
            queryClient.invalidateQueries({ queryKey: ['latestMedias', mediaType] });
            queryClient.invalidateQueries({ queryKey: ['userStats'] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            queryClient.invalidateQueries({ queryKey: ['saga'] });
            queryClient.invalidateQueries({ queryKey: ['sagas'] });
        },
    });
};

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../context/ApiContext';
import type { CatalogProvider, WatchProvider } from '../api/mediaApi';

export const MY_PLATFORMS_KEY = ['myPlatforms'] as const;
export const PLATFORM_CATALOG_KEY = ['platformCatalog'] as const;

export const providerLogoUrl = (logoPath: string, size = 'w92') => `https://image.tmdb.org/t/p/${size}${logoPath}`;

// "Mes plateformes" : abonnements choisis dans les réglages, utilisés partout dans l'app
// (badge sur les cartes, "Où regarder", filtre du tirage au sort, rangée de Découvrir)
export const useMyPlatforms = () => {
    const api = useApi();

    const { data: selectedIds = [], isLoading } = useQuery({
        queryKey: MY_PLATFORMS_KEY,
        queryFn: () => api.media.getMyProviders(),
        // Court : un changement fait sur un autre appareil arrive vite (la requête est légère)
        staleTime: 1000 * 60,
    });

    // Le catalogue sert à connaître les variantes d'une offre (ex : Netflix avec pub)
    const { data: catalog } = useQuery({
        queryKey: PLATFORM_CATALOG_KEY,
        queryFn: () => api.media.getProviderCatalog(),
        staleTime: 1000 * 60 * 60 * 24,
        enabled: selectedIds.length > 0,
    });

    // Variante -> plateforme choisie (ex : "Netflix Standard with Ads" -> Netflix)
    const toSelected = useMemo(() => {
        const map = new Map<number, number>(selectedIds.map(id => [id, id]));
        catalog?.forEach(entry => {
            if (map.has(entry.provider_id)) entry.alias_ids.forEach(alias => map.set(alias, entry.provider_id));
        });
        return map;
    }, [selectedIds, catalog]);

    const matchIds = useMemo(() => new Set(toSelected.keys()), [toSelected]);

    // Plateformes de l'utilisateur sur lesquelles un titre est inclus (vide si inconnu ou aucune),
    // une seule fois par abonnement même si le titre est listé sous plusieurs variantes
    const myProvidersFor = useMemo(
        () => (available?: WatchProvider[] | null) => {
            const seen = new Set<number>();
            return (available ?? []).filter(p => {
                const owner = toSelected.get(p.provider_id);
                if (owner === undefined || seen.has(owner)) return false;
                seen.add(owner);
                return true;
            });
        },
        [toSelected],
    );

    return { selectedIds, matchIds, hasPlatforms: selectedIds.length > 0, isLoading, myProvidersFor };
};

export const usePlatformCatalog = () => {
    const api = useApi();
    return useQuery<CatalogProvider[]>({
        queryKey: PLATFORM_CATALOG_KEY,
        queryFn: () => api.media.getProviderCatalog(),
        staleTime: 1000 * 60 * 60 * 24,
    });
};

// Enregistre la sélection (affichage immédiat, retour en arrière en cas d'erreur)
export const useSetMyPlatforms = () => {
    const api = useApi();
    const queryClient = useQueryClient();

    return useMutation<number[], Error, number[], { previous?: number[] }>({
        mutationFn: ids => api.media.setMyProviders(ids),
        onMutate: async ids => {
            await queryClient.cancelQueries({ queryKey: MY_PLATFORMS_KEY });
            const previous = queryClient.getQueryData<number[]>(MY_PLATFORMS_KEY);
            queryClient.setQueryData(MY_PLATFORMS_KEY, ids);
            return { previous };
        },
        onError: (_err, _ids, context) => {
            if (context?.previous) queryClient.setQueryData(MY_PLATFORMS_KEY, context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: MY_PLATFORMS_KEY });
            queryClient.invalidateQueries({ queryKey: ['discover', 'movie', 'my_platforms'] });
            queryClient.invalidateQueries({ queryKey: ['discover', 'tv', 'my_platforms'] });
        },
    });
};

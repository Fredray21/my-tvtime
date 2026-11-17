import { Navigate, useParams } from 'react-router-dom';
import { Flame, Clapperboard, Tv } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { MediaGridPage } from '../../components/MediaGridPage';
import { findDiscoverList } from './discoverLists';

// Page "Tout voir" d'une rangée de découverte (/discover/:type/:list)
export const DiscoverListView = () => {
    const api = useApi();
    const { type, list } = useParams();
    const def = findDiscoverList(type, list);

    if (!def) return <Navigate to="/search" replace />;

    return (
        <MediaGridPage
            key={`${def.mediaType}-${def.list}`}
            title={def.title}
            icon={def.list === 'trending' ? Flame : def.mediaType === 'movie' ? Clapperboard : Tv}
            mediaType={def.mediaType}
            queryKey={['discover', def.mediaType, def.list, 'infinite']}
            queryFn={({ pageParam }) => api.search.getDiscoverList(def.mediaType, def.list, pageParam)}
            emptyTitle="Rien pour le moment"
            emptyDescription="Cette liste est vide, reviens plus tard."
            showStatusBadge
        />
    );
};

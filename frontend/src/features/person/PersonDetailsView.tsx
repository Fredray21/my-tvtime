import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Cake, MapPin, Cross, Film, Tv, ExternalLink, Star } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { MediaCard } from '../../components/MediaCard';
import { triggerVibration } from '../../utils/haptics';
import type { PersonCredit, PersonCreditGroup } from '../../api/mediaApi';
import { OfflineNotice } from '../../offline/OfflineNotice';

type MediaTab = 'movie' | 'tv';
type RoleTab = 'cast' | 'crew';
type SortMode = 'recent' | 'popular' | 'rating';
type SeenFilter = 'all' | 'seen' | 'unseen';

// Statuts considérés comme "vu" (film vu, ou série commencée)
const SEEN_STATUSES = ['watched', 'watching', 'finished', 'pending'];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
    watched: { label: 'Vu', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
    finished: { label: 'Terminée', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' },
    pending: { label: 'À jour', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    watching: { label: 'En cours', className: 'bg-amber-500/20 text-amber-400 border-amber-500/20' },
    watchlist: { label: 'À voir', className: 'bg-purple-500/20 text-purple-300 border-purple-500/20' },
};

const DEPARTMENT_LABELS: Record<string, string> = {
    Directing: 'Réalisation',
    Writing: 'Scénario',
    Production: 'Production',
    Sound: 'Musique',
    Camera: 'Photographie',
    Editing: 'Montage',
    Creator: 'Création',
    Art: 'Direction artistique',
    'Costume & Make-Up': 'Costumes & Maquillage',
    'Visual Effects': 'Effets visuels',
    Crew: 'Équipe technique',
    Lighting: 'Éclairage',
};

// TMDB ne traduit pas les postes de l'équipe technique
const JOB_LABELS: Record<string, string> = {
    Director: 'Réalisation',
    Screenplay: 'Scénario',
    Writer: 'Scénariste',
    Story: 'Histoire',
    Novel: 'Roman',
    Characters: 'Personnages',
    Creator: 'Création',
    Producer: 'Production',
    'Executive Producer': 'Production exécutive',
    'Co-Producer': 'Coproduction',
    'Original Music Composer': 'Musique',
    'Director of Photography': 'Photographie',
    Editor: 'Montage',
};

const translateJob = (job: string) => job.split(' / ').map(j => JOB_LABELS[j] || j).join(' / ');

const isSeen = (credit: PersonCredit) => SEEN_STATUSES.includes(credit.status_local);
const getDate = (credit: PersonCredit) => credit.release_date || credit.first_air_date || '';

const formatDate = (date: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));

const computeAge = (birthday: string, until?: string | null) => {
    const birth = new Date(birthday);
    const end = until ? new Date(until) : new Date();
    let age = end.getFullYear() - birth.getFullYear();
    const hadBirthday = end.getMonth() > birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() >= birth.getDate());
    if (!hadBirthday) age--;
    return age;
};

export const PersonDetailsView = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const api = useApi();

    const personId = Number(id);

    const { data: person, isLoading, isError, fetchStatus } = useQuery({
        queryKey: ['person', personId],
        queryFn: () => api.media.getPersonDetails(personId),
        enabled: !isNaN(personId),
    });

    // Onglets, tri et filtre dans l'URL : au retour depuis un film, on retrouve la filmographie telle qu'on l'a laissée
    const [searchParams, setSearchParams] = useSearchParams();
    const roleParam = searchParams.get('role');
    const mediaParam = searchParams.get('media');
    const sortParam = searchParams.get('sort');
    const seenParam = searchParams.get('seen');
    const roleTab: RoleTab | null = roleParam === 'cast' || roleParam === 'crew' ? roleParam : null;
    const mediaTab: MediaTab | null = mediaParam === 'movie' || mediaParam === 'tv' ? mediaParam : null;
    const sortMode: SortMode = sortParam === 'popular' || sortParam === 'rating' ? sortParam : 'recent';
    const seenFilter: SeenFilter = seenParam === 'seen' || seenParam === 'unseen' ? seenParam : 'all';

    const updateParams = (changes: Record<string, string | null>) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(changes).forEach(([key, value]) => (value === null ? next.delete(key) : next.set(key, value)));
            return next;
        }, { replace: true, preventScrollReset: true }); // changer un filtre ne doit pas remonter en haut de page
    };
    const setMediaTab = (value: MediaTab) => updateParams({ media: value });
    const setSortMode = (value: SortMode) => updateParams({ sort: value });
    const setSeenFilter = (value: SeenFilter) => updateParams({ seen: value });
    const [isBioExpanded, setIsBioExpanded] = useState(false);

    // Par défaut : "Acteur" pour les acteurs, "Équipe" pour les réalisateurs / scénaristes...
    const hasCast = !!person && person.cast.movies.length + person.cast.tv.length > 0;
    const hasCrew = !!person && person.crew.movies.length + person.crew.tv.length > 0;
    const defaultRole: RoleTab = person?.known_for_department === 'Acting' ? (hasCast ? 'cast' : 'crew') : (hasCrew ? 'crew' : 'cast');
    const activeRole = roleTab ?? defaultRole;
    const group: PersonCreditGroup = useMemo(() => person?.[activeRole] ?? { movies: [], tv: [] }, [person, activeRole]);

    const defaultMediaTab: MediaTab = group.movies.length >= group.tv.length ? 'movie' : 'tv';
    const activeMediaTab = mediaTab ?? defaultMediaTab;
    const credits = activeMediaTab === 'movie' ? group.movies : group.tv;

    // "Connu pour" : les titres les plus populaires, films et séries confondus
    const knownFor = useMemo(() => {
        return [...group.movies, ...group.tv]
            .filter(c => c.poster_path)
            .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
            .slice(0, 10);
    }, [group]);

    const backdropPath = knownFor.find(c => c.backdrop_path)?.backdrop_path;

    const filteredCredits = useMemo(() => {
        const list = credits.filter(c => {
            if (seenFilter === 'seen') return isSeen(c);
            if (seenFilter === 'unseen') return !isSeen(c);
            return true;
        });

        return [...list].sort((a, b) => {
            if (sortMode === 'popular') return (b.vote_count || 0) - (a.vote_count || 0);
            if (sortMode === 'rating') return (b.vote_average || 0) - (a.vote_average || 0);
            // Récents : les projets sans date (annoncés) d'abord, puis du plus récent au plus ancien
            const dateA = getDate(a);
            const dateB = getDate(b);
            if (!dateA) return -1;
            if (!dateB) return 1;
            return dateB.localeCompare(dateA);
        });
    }, [credits, seenFilter, sortMode]);

    if (isLoading && fetchStatus === 'paused') return <OfflineNotice what="Cette fiche" />;
    if (isLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 animate-pulse">Chargement de la fiche...</div>;
    if (isError || !person) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">Erreur lors du chargement.</div>;

    const profileUrl = person.profile_path
        ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
        : 'https://dummyimage.com/500x750?text=No+Photo';

    const departmentLabel = person.known_for_department === 'Acting'
        ? (person.gender === 1 ? 'Actrice' : 'Acteur')
        : DEPARTMENT_LABELS[person.known_for_department] || person.known_for_department;

    const seenMovies = group.movies.filter(isSeen).length;
    const seenSeries = group.tv.filter(isSeen).length;
    const totalSeen = seenMovies + seenSeries;
    const totalCredits = group.movies.length + group.tv.length;
    const seenPercent = totalCredits > 0 ? Math.round((totalSeen / totalCredits) * 100) : 0;

    const pillClass = (active: boolean) =>
        `px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${active
            ? 'bg-white text-black border-white'
            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`;

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            {/* HEADER : fond flouté issu de son titre le plus connu + Bouton retour */}
            <div className="relative w-full h-48 sm:h-64 bg-zinc-900 overflow-hidden">
                {backdropPath && (
                    <img
                        src={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
                        alt=""
                        className="w-full h-full object-cover opacity-60 blur-sm scale-110"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent"></div>

                <button
                    onClick={() => {
                        triggerVibration()
                        navigate(-1)
                    }}
                    className="absolute top-4 left-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/60 transition aspect-square"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>
            </div>

            <div className="px-4 -mt-24 sm:-mt-28 relative z-10 max-w-4xl mx-auto">
                {/* IDENTITÉ */}
                <div className="flex items-end gap-4 mb-6">
                    <div className="w-28 sm:w-36 aspect-[2/3] flex-shrink-0 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl">
                        <img src={profileUrl} alt={person.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 pb-1">
                        <span className="inline-block bg-zinc-800/80 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-2">
                            {departmentLabel}
                        </span>
                        <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">{person.name}</h1>
                    </div>
                </div>

                {/* INFOS PERSONNELLES */}
                <div className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400 mb-6">
                    {person.birthday && (
                        <span className="flex items-center gap-2">
                            <Cake size={14} className="text-zinc-500" />
                            {formatDate(person.birthday)}
                            {!person.deathday && <span className="text-zinc-500">· {computeAge(person.birthday)} ans</span>}
                        </span>
                    )}
                    {person.deathday && (
                        <span className="flex items-center gap-2">
                            <Cross size={14} className="text-zinc-500" />
                            {formatDate(person.deathday)}
                            {person.birthday && <span className="text-zinc-500">· à {computeAge(person.birthday, person.deathday)} ans</span>}
                        </span>
                    )}
                    {person.place_of_birth && (
                        <span className="flex items-center gap-2">
                            <MapPin size={14} className="text-zinc-500" />
                            {person.place_of_birth}
                        </span>
                    )}
                </div>

                {/* LIENS EXTERNES */}
                {(person.imdb_id || person.instagram_id) && (
                    <div className="flex flex-wrap gap-2 mb-8">
                        {person.imdb_id && (
                            <a
                                href={`https://www.imdb.com/name/${person.imdb_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 bg-amber-400 text-black px-3 py-1.5 rounded-lg text-xs font-black"
                            >
                                IMDb <ExternalLink size={12} />
                            </a>
                        )}
                        {person.instagram_id && (
                            <a
                                href={`https://www.instagram.com/${person.instagram_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-bold"
                            >
                                Instagram <ExternalLink size={12} />
                            </a>
                        )}
                    </div>
                )}

                {/* TA PROGRESSION : croisement filmographie x historique de l'utilisateur */}
                {totalCredits > 0 && (
                    <div className="mb-8 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50">
                        <div className="flex items-baseline justify-between mb-3">
                            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Ta progression</h2>
                            <span className="text-2xl font-black text-emerald-400">{seenPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${seenPercent}%` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1"><Film size={10} /> Films vus</h3>
                                <p className="text-zinc-200 text-sm font-medium">
                                    <span className="text-white font-bold">{seenMovies}</span> / {group.movies.length}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1"><Tv size={10} /> Séries commencées</h3>
                                <p className="text-zinc-200 text-sm font-medium">
                                    <span className="text-white font-bold">{seenSeries}</span> / {group.tv.length}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* BIOGRAPHIE */}
                <div className="mb-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-2">Biographie</h2>
                    {person.biography ? (
                        <>
                            <p className={`text-zinc-300 text-sm leading-relaxed opacity-90 whitespace-pre-line ${isBioExpanded ? '' : 'line-clamp-5'}`}>
                                {person.biography}
                            </p>
                            {person.biography.length > 300 && (
                                <button
                                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                                    className="mt-2 text-xs font-bold text-purple-400 hover:text-purple-300"
                                >
                                    {isBioExpanded ? 'Réduire' : 'Lire la suite'}
                                </button>
                            )}
                        </>
                    ) : (
                        <p className="text-zinc-500 text-sm italic">Aucune biographie disponible.</p>
                    )}
                </div>

                {/* CONNU POUR */}
                {knownFor.length > 0 && (
                    <div className="mb-12 mt-12 border-t border-zinc-800/50 pt-8">
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">Connu pour</h2>
                        <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-none snap-x">
                            {knownFor.map((credit) => (
                                <div key={`${credit.media_type}-${credit.id}`} className="w-28 flex-shrink-0 snap-start">
                                    <MediaCard item={credit} layout="card" fallbackMediaType={credit.media_type} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* FILMOGRAPHIE */}
                <div className="mb-12 mt-12 border-t border-zinc-800/50 pt-8">
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">Filmographie</h2>

                    {hasCast && hasCrew && (
                        <div className="flex bg-zinc-900 rounded-xl p-1 mb-4 border border-zinc-800">
                            {(['cast', 'crew'] as const).map((role) => (
                                <button
                                    key={role}
                                    onClick={() => {
                                        triggerVibration();
                                        updateParams({ role, media: null });
                                    }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeRole === role ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {role === 'cast' ? 'Rôles' : 'Équipe technique'}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button onClick={() => setMediaTab('movie')} className={pillClass(activeMediaTab === 'movie')}>
                            Films · {group.movies.length}
                        </button>
                        <button onClick={() => setMediaTab('tv')} className={pillClass(activeMediaTab === 'tv')}>
                            Séries · {group.tv.length}
                        </button>

                        <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value as SortMode)}
                            className="ml-auto bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-bold rounded-lg px-2 py-1.5 outline-none"
                        >
                            <option value="recent">Récents</option>
                            <option value="popular">Populaires</option>
                            <option value="rating">Mieux notés</option>
                        </select>
                    </div>

                    <div className="flex gap-2 mb-5">
                        {([['all', 'Tous'], ['seen', 'Vus'], ['unseen', 'Pas vus']] as const).map(([value, label]) => (
                            <button key={value} onClick={() => setSeenFilter(value)} className={pillClass(seenFilter === value)}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {filteredCredits.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            {filteredCredits.map((credit) => (
                                <CreditRow key={credit.id} credit={credit} mediaType={activeMediaTab} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-4 rounded-xl text-center border border-dashed border-zinc-800">
                            Aucun titre à afficher.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CreditRow = ({ credit, mediaType }: { credit: PersonCredit; mediaType: MediaTab }) => {
    const title = credit.title || credit.name || 'Sans titre';
    const date = getDate(credit);
    const year = date ? new Date(date).getFullYear() : null;
    const role = credit.character || (credit.job && translateJob(credit.job));
    const badge = STATUS_BADGES[credit.status_local];

    return (
        <Link
            to={`/${mediaType}/${credit.id}`}
            className={`flex items-center gap-3 bg-zinc-900/60 border rounded-xl p-2 pr-3 transition-all hover:border-zinc-700 ${isSeen(credit) ? 'border-emerald-500/20' : 'border-zinc-800/40'}`}
        >
            <div className="w-12 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-zinc-950">
                {credit.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w154${credit.poster_path}`} alt={title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        {mediaType === 'movie' ? <Film size={16} /> : <Tv size={16} />}
                    </div>
                )}
            </div>

            <div className="flex-grow min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">{title}</h3>
                {role && <p className="text-xs text-zinc-500 line-clamp-1">{role}</p>}
                <div className="flex items-center gap-2 mt-1 text-[10px] font-medium text-zinc-500">
                    <span>{year ?? 'À venir'}</span>
                    {mediaType === 'tv' && !!credit.episode_count && <span>· {credit.episode_count} ép.</span>}
                    {!!credit.vote_average && credit.vote_average > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-400">
                            <Star fill="currentColor" size={9} /> {credit.vote_average.toFixed(1)}
                        </span>
                    )}
                </div>
            </div>

            {badge && (
                <span className={`flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-bold border ${badge.className}`}>
                    {badge.label}
                </span>
            )}
        </Link>
    );
};

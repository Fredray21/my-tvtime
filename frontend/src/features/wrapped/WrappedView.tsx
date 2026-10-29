import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clapperboard, Tv, Sparkles, CalendarDays, Repeat, Flame, Zap, CalendarCheck, Trophy, Heart, Share2 } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { triggerVibration } from '../../utils/haptics';
import type { WrappedTitle } from '../../api/userApi';
import { ShareWrappedModal } from './ShareWrappedModal';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const formatDay = (date: string) =>
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date));

const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}h${rest > 0 ? rest.toString().padStart(2, '0') : ''}` : `${rest} min`;
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">{children}</h2>
);

const MonthTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { month: number; minutes: number; movies: number; episodes: number } }[] }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
        <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-xl">
            <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">{MONTHS_FULL[data.month - 1]}</p>
            <p className="text-white text-sm font-bold">{formatHours(data.minutes)}</p>
            <p className="text-zinc-500 text-[10px]">{data.movies} films · {data.episodes} épisodes</p>
        </div>
    );
};

const PosterLink = ({ title, size = 'w-28' }: { title: WrappedTitle; size?: string }) => (
    <Link to={`/${title.media_type}/${title.id}`} className={`${size} flex-shrink-0 snap-start group`}>
        <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/40 relative">
            <img
                src={title.poster_path ? `https://image.tmdb.org/t/p/w342${title.poster_path}` : 'https://dummyimage.com/342x513?text=No+Poster'}
                alt={title.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
            />
            {title.is_favorite && (
                <div className="absolute top-2 right-2 bg-black/90 text-red-500 p-1.5 rounded-full">
                    <Heart fill="currentColor" size={10} />
                </div>
            )}
        </div>
        <p className="text-xs font-medium mt-2 text-zinc-300 line-clamp-1 group-hover:text-white">{title.title}</p>
    </Link>
);

export const WrappedView = () => {
    const api = useApi();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedYear = Number(searchParams.get('year')) || undefined;
    const [isShareOpen, setIsShareOpen] = useState(false);

    const { data: wrapped, isLoading, isError } = useQuery({
        queryKey: ['wrapped', requestedYear ?? 'default'],
        queryFn: () => api.user.getWrapped(requestedYear),
        staleTime: 1000 * 60 * 30,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-500 px-8 text-center">
                <Sparkles className="text-purple-500 animate-pulse" size={32} />
                <p className="animate-pulse">On rembobine ton année...</p>
                <p className="text-[10px] text-zinc-600">La première fois, ça peut prendre quelques secondes.</p>
            </div>
        );
    }
    if (isError || !wrapped) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-red-500">Erreur lors du chargement.</div>;

    const isEmpty = wrapped.movies_count + wrapped.episodes_count + wrapped.rewatch_count === 0;
    const hero = wrapped.top_series[0] ?? wrapped.highlight_movies[0];
    const totalHours = Math.round(wrapped.total_minutes / 60);
    const moviePercent = wrapped.total_minutes > 0 ? Math.round((wrapped.movie_minutes / wrapped.total_minutes) * 100) : 0;
    const topMonth = wrapped.monthly.reduce((best, m) => (m.minutes > best.minutes ? m : best), wrapped.monthly[0]);
    const maxWeekday = Math.max(...wrapped.weekdays);
    const favoriteWeekday = maxWeekday > 0 ? WEEKDAYS[wrapped.weekdays.indexOf(maxWeekday)] : null;
    const maxGenre = wrapped.top_genres[0]?.count || 1;

    const selectYear = (year: number) => {
        triggerVibration();
        // replace : changer d'année ne doit pas empiler l'historique (le bouton retour ramène direct au profil)
        setSearchParams({ year: String(year) }, { replace: true });
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            {/* HERO */}
            <div className="relative w-full h-72 sm:h-80 overflow-hidden bg-gradient-to-br from-purple-900 via-zinc-900 to-zinc-950">
                {hero?.backdrop_path && (
                    <img
                        src={`https://image.tmdb.org/t/p/w1280${hero.backdrop_path}`}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-purple-950/40 to-transparent"></div>

                <button
                    onClick={() => {
                        triggerVibration()
                        navigate(-1)
                    }}
                    className="absolute top-4 left-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/60 transition aspect-square z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                </button>

                {!isEmpty && (
                    <button
                        onClick={() => {
                            triggerVibration([15, 30]);
                            setIsShareOpen(true);
                        }}
                        className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-2 rounded-full text-white text-xs font-bold hover:bg-black/60 transition z-10"
                    >
                        <Share2 size={16} /> Partager
                    </button>
                )}

                <div className="absolute bottom-6 left-0 right-0 px-4 max-w-4xl mx-auto">
                    <p className="text-purple-300 text-xs font-bold uppercase tracking-[0.3em] mb-1 flex items-center gap-2">
                        <Sparkles size={14} /> Ton année en revue
                    </p>
                    <h1 className="text-7xl font-black tracking-tighter leading-none">{wrapped.year}</h1>
                </div>
            </div>

            <div className="px-4 max-w-4xl mx-auto">
                {/* SÉLECTEUR D'ANNÉE */}
                {wrapped.available_years.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-none mb-6 py-2 -mx-4 px-4">
                        {wrapped.available_years.map(year => (
                            <button
                                key={year}
                                onClick={() => selectYear(year)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex-shrink-0 ${year === wrapped.year
                                    ? 'bg-purple-500 text-black border-purple-500'
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'}`}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                )}

                {isEmpty ? (
                    <div className="text-zinc-500 text-sm italic bg-zinc-900/30 p-6 rounded-xl text-center border border-dashed border-zinc-800 mt-8">
                        Rien de regardé en {wrapped.year} pour l'instant. Lance un film !
                    </div>
                ) : (
                    <>
                        {/* TEMPS TOTAL */}
                        <div className="mb-10 bg-gradient-to-br from-purple-500/20 to-zinc-900/40 p-6 rounded-2xl border border-purple-500/20">
                            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Temps passé devant l'écran</p>
                            <p className="text-6xl font-black tracking-tight">
                                {totalHours}<span className="text-2xl text-purple-300 ml-1">heures</span>
                            </p>
                            <p className="text-zinc-400 text-sm mt-1">
                                soit <span className="text-white font-bold">{(wrapped.total_minutes / 60 / 24).toFixed(1)} jours</span> non-stop
                            </p>

                            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-5 flex">
                                <div className="h-full bg-purple-500" style={{ width: `${moviePercent}%` }} />
                                <div className="h-full bg-amber-400" style={{ width: `${100 - moviePercent}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mt-2">
                                <span className="text-purple-300 flex items-center gap-1"><Clapperboard size={10} /> Films · {formatHours(wrapped.movie_minutes)}</span>
                                <span className="text-amber-400 flex items-center gap-1"><Tv size={10} /> Séries · {formatHours(wrapped.tv_minutes)}</span>
                            </div>
                        </div>

                        {/* CHIFFRES CLÉS */}
                        <div className="grid grid-cols-3 gap-3 mb-10">
                            {[
                                { value: wrapped.movies_count, label: 'Films vus' },
                                { value: wrapped.episodes_count, label: 'Épisodes' },
                                { value: wrapped.series_count, label: 'Séries' },
                                { value: wrapped.new_series, label: 'Nouvelles séries' },
                                { value: wrapped.active_days, label: 'Jours actifs' },
                                { value: wrapped.rewatch_count, label: 'Films revus' },
                            ].map(stat => (
                                <div key={stat.label} className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl text-center">
                                    <p className="text-2xl font-black text-zinc-100">{stat.value}</p>
                                    <p className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5 font-medium">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* MOIS PAR MOIS */}
                        <div className="mb-10">
                            <SectionTitle>Mois par mois</SectionTitle>
                            <p className="text-zinc-400 text-sm mb-4">
                                Ton mois le plus intense : <span className="text-white font-bold">{MONTHS_FULL[topMonth.month - 1]}</span> avec {formatHours(topMonth.minutes)}.
                            </p>
                            <div className="h-40 bg-zinc-900/40 rounded-xl border border-zinc-800/50 p-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wrapped.monthly} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                                        <XAxis dataKey="month" tickFormatter={(m: number) => MONTHS[m - 1]} tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                                        <Tooltip content={<MonthTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                        <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                                            {wrapped.monthly.map(m => (
                                                <Cell key={m.month} fill={m.month === topMonth.month ? '#a855f7' : '#3f3f46'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* TOP SÉRIES */}
                        {wrapped.top_series.length > 0 && (
                            <div className="mb-10">
                                <SectionTitle>Tes séries de l'année</SectionTitle>
                                <div className="flex flex-col gap-2">
                                    {wrapped.top_series.map((series, index) => (
                                        <Link
                                            key={series.id}
                                            to={`/tv/${series.id}`}
                                            className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-2 pr-4 hover:border-zinc-700 transition-all"
                                        >
                                            <span className={`w-8 text-center text-2xl font-black ${index === 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{index + 1}</span>
                                            <img
                                                src={series.poster_path ? `https://image.tmdb.org/t/p/w154${series.poster_path}` : 'https://dummyimage.com/154x231?text=?'}
                                                alt={series.title}
                                                className="w-12 aspect-[2/3] rounded-lg object-cover flex-shrink-0"
                                                loading="lazy"
                                            />
                                            <div className="flex-grow min-w-0">
                                                <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1">{series.title}</h3>
                                                <p className="text-xs text-zinc-500">{series.episodes} épisodes · {formatHours(series.minutes)}</p>
                                            </div>
                                            {index === 0 && <Trophy size={18} className="text-amber-400 flex-shrink-0" />}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FILMS MARQUANTS */}
                        {wrapped.highlight_movies.length > 0 && (
                            <div className="mb-10">
                                <SectionTitle>Tes films marquants</SectionTitle>
                                <p className="text-zinc-500 text-xs -mt-2 mb-4">Tes coups de cœur d'abord, puis les films revus, puis les mieux notés sur TMDB.</p>
                                <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-none snap-x">
                                    {wrapped.highlight_movies.map(movie => <PosterLink key={movie.id} title={movie} />)}
                                </div>
                            </div>
                        )}

                        {/* GENRES */}
                        {wrapped.top_genres.length > 0 && (
                            <div className="mb-10">
                                <SectionTitle>Tes genres</SectionTitle>
                                <div className="flex flex-col gap-2.5">
                                    {wrapped.top_genres.map((genre, index) => (
                                        <div key={genre.name} className="flex items-center gap-3">
                                            <span className="w-28 flex-shrink-0 text-xs font-medium text-zinc-300 line-clamp-1">{genre.name}</span>
                                            <div className="flex-grow h-6 bg-zinc-900 rounded-md overflow-hidden">
                                                <div
                                                    className={`h-full rounded-md ${index === 0 ? 'bg-purple-500' : 'bg-zinc-700'}`}
                                                    style={{ width: `${(genre.count / maxGenre) * 100}%` }}
                                                />
                                            </div>
                                            <span className="w-8 text-right text-xs font-bold text-zinc-400">{genre.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ACTEURS */}
                        {wrapped.top_actors.length > 0 && (
                            <div className="mb-10">
                                <SectionTitle>Les visages de ton année</SectionTitle>
                                <div className="grid grid-cols-3 gap-3">
                                    {wrapped.top_actors.map(actor => (
                                        <Link key={actor.id} to={`/person/${actor.id}`} className="group">
                                            <div className="aspect-square rounded-full overflow-hidden bg-zinc-900 border-2 border-zinc-800 group-hover:border-purple-500 transition-colors">
                                                <img
                                                    src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : 'https://dummyimage.com/185x185?text=?'}
                                                    alt={actor.name}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            </div>
                                            <p className="text-xs font-semibold mt-2 text-zinc-200 text-center line-clamp-1">{actor.name}</p>
                                            <p className="text-[10px] text-zinc-500 text-center">{actor.count} titres</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* RECORDS */}
                        <div className="mb-10">
                            <SectionTitle>Tes records</SectionTitle>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {wrapped.biggest_binge && (
                                    <Link to={`/tv/${wrapped.biggest_binge.series.id}`} className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-4 hover:border-zinc-700 transition-all">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1"><Flame size={12} className="text-orange-500" /> Plus gros binge</p>
                                        <p className="text-sm text-zinc-200">
                                            <span className="text-white font-black text-lg">{wrapped.biggest_binge.episodes} épisodes</span> de {wrapped.biggest_binge.series.title}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">le {formatDay(wrapped.biggest_binge.date)}</p>
                                    </Link>
                                )}
                                {wrapped.busiest_day && (
                                    <div className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-4">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1"><Zap size={12} className="text-amber-400" /> Journée la plus chargée</p>
                                        <p className="text-white font-black text-lg">{formatHours(wrapped.busiest_day.minutes)}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">
                                            le {formatDay(wrapped.busiest_day.date)} · {wrapped.busiest_day.movies} films, {wrapped.busiest_day.episodes} épisodes
                                        </p>
                                    </div>
                                )}
                                {wrapped.longest_streak > 1 && (
                                    <div className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-4">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1"><Repeat size={12} className="text-emerald-400" /> Plus longue série</p>
                                        <p className="text-white font-black text-lg">{wrapped.longest_streak} jours d'affilée</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">avec au moins un film ou un épisode</p>
                                    </div>
                                )}
                                {favoriteWeekday && (
                                    <div className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-4">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-1"><CalendarDays size={12} className="text-purple-400" /> Jour préféré</p>
                                        <p className="text-white font-black text-lg capitalize">{favoriteWeekday}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">le jour où tu regardes le plus</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PREMIER / DERNIER FILM */}
                        {wrapped.first_movie && wrapped.last_movie && wrapped.first_movie.id !== wrapped.last_movie.id && (
                            <div className="mb-10">
                                <SectionTitle>Début et fin</SectionTitle>
                                <div className="grid grid-cols-2 gap-4">
                                    {[{ label: 'Premier film', movie: wrapped.first_movie }, { label: 'Dernier film', movie: wrapped.last_movie }].map(({ label, movie }) => (
                                        <div key={label}>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                                                <CalendarCheck size={12} /> {label}
                                            </p>
                                            <PosterLink title={movie} size="w-full" />
                                            {movie.watched_at && <p className="text-[10px] text-zinc-500">{new Date(movie.watched_at).toLocaleDateString('fr-FR')}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                triggerVibration([15, 30]);
                                setIsShareOpen(true);
                            }}
                            className="w-full mb-8 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-purple-500 to-fuchsia-500 text-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        >
                            <Share2 size={18} /> Partager mon année {wrapped.year}
                        </button>

                        {wrapped.backfill_days > 0 && (
                            <p className="text-[10px] text-zinc-600 text-center italic">
                                {wrapped.backfill_days} journée{wrapped.backfill_days > 1 ? 's' : ''} de rattrapage (plus de 16h ajoutées d'un coup) {wrapped.backfill_days > 1 ? 'sont comptées' : 'est comptée'} dans les totaux mais pas dans les records.
                            </p>
                        )}
                    </>
                )}
            </div>

            {isShareOpen && <ShareWrappedModal wrapped={wrapped} onClose={() => setIsShareOpen(false)} />}
        </div>
    );
};

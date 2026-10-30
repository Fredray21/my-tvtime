import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers, Popcorn } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { triggerVibration } from '../../utils/haptics';

type Filter = 'in_progress' | 'complete';

export const SagasView = () => {
    const api = useApi();
    const navigate = useNavigate();
    // L'onglet est dans l'URL : au retour depuis une saga, on retrouve le même onglet (et la même position)
    const [searchParams, setSearchParams] = useSearchParams();
    const filter: Filter = searchParams.get('tab') === 'complete' ? 'complete' : 'in_progress';
    const setFilter = (value: Filter) => setSearchParams({ tab: value }, { replace: true, preventScrollReset: true });

    const { data: sagas, isLoading, isError } = useQuery({
        queryKey: ['sagas'],
        queryFn: () => api.media.getUserSagas(),
        staleTime: 1000 * 60 * 10,
    });

    const inProgress = sagas?.filter(s => !s.is_complete) ?? [];
    const complete = sagas?.filter(s => s.is_complete) ?? [];
    const displayed = filter === 'in_progress' ? inProgress : complete;

    return (
        <div className="min-h-screen bg-zinc-950 text-white pb-24">
            <div className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md pt-6 px-4 border-b border-zinc-900/50">
                <div className="max-w-4xl mx-auto w-full">
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={() => {
                                triggerVibration()
                                navigate(-1)
                            }}
                            className="bg-zinc-900 border border-zinc-800 p-2 rounded-full text-zinc-300 hover:text-white transition aspect-square"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Layers size={22} /> Mes sagas</h1>
                    </div>

                    <div className="flex bg-zinc-900 rounded-xl p-1 mb-4">
                        {([['in_progress', 'En cours', inProgress.length], ['complete', 'Terminées', complete.length]] as const).map(([value, label, count]) => (
                            <button
                                key={value}
                                onClick={() => { triggerVibration(10); setFilter(value); }}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${filter === value ? 'bg-purple-500 text-black shadow-md' : 'text-zinc-400 hover:text-zinc-300'}`}
                            >
                                {label}{sagas ? ` · ${count}` : ''}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 w-full mt-6">
                {isLoading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-[2/3] bg-zinc-900 rounded-xl animate-pulse" />)}
                    </div>
                ) : isError ? (
                    <div className="text-red-500 text-center pt-10">Erreur lors du chargement.</div>
                ) : displayed.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10 p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 max-w-md mx-auto text-center">
                        <Popcorn className="w-12 h-12 text-zinc-700 mb-4" />
                        <h2 className="text-lg font-bold mb-1">{filter === 'in_progress' ? 'Aucune saga en cours' : 'Aucune saga terminée'}</h2>
                        <p className="text-sm text-zinc-500">Les sagas apparaissent dès que tu as vu un de leurs films.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {displayed.map(saga => {
                            const percent = Math.round((saga.watched_count / saga.released_count) * 100);
                            return (
                                <Link key={saga.id} to={`/saga/${saga.id}`} className="group bg-zinc-900/50 border border-zinc-800/40 rounded-lg overflow-hidden hover:border-zinc-700 transition-all">
                                    <div className="aspect-[2/3] relative bg-zinc-950">
                                        {saga.poster_path && (
                                            <img src={`https://image.tmdb.org/t/p/w342${saga.poster_path}`} alt={saga.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                                        )}
                                        <div className="absolute top-1 right-1 bg-zinc-950/85 backdrop-blur-sm border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-black">
                                            <span className={saga.is_complete ? 'text-emerald-400' : 'text-white'}>{saga.watched_count}/{saga.released_count}</span>
                                        </div>
                                    </div>
                                    <div className="p-1.5">
                                        <h3 className="text-[11px] font-semibold text-zinc-100 line-clamp-1">{saga.name.replace(/ - Saga$/, '')}</h3>
                                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-1">
                                            <div className={`h-full rounded-full ${saga.is_complete ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${percent}%` }} />
                                        </div>
                                        {!saga.is_complete && saga.next_movie && (
                                            <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1"><span className="text-zinc-300">{saga.next_movie.title}</span></p>
                                        )}
                                        {saga.upcoming_count > 0 && (
                                            <p className="text-[10px] text-purple-400">{saga.upcoming_count} à venir</p>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

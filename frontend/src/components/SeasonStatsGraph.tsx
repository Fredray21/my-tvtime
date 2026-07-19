import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../context/ApiContext';
import { ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { triggerVibration } from '../utils/haptics'; // <-- Ajout de l'import haptique

interface SeasonStatsGraphProps {
    seriesId: number;
    seasons: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-xl z-50">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    Épisode {data.episode}
                </p>
                <p className="text-white text-sm font-semibold line-clamp-2 mb-2 w-48">
                    {data.name}
                </p>
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-lg">
                    <span>⭐️</span> {data.rating.toFixed(1)}
                    <span className="text-zinc-500 text-xs font-normal">/ 5</span>
                </div>
            </div>
        );
    }
    return null;
};

export const SeasonStatsGraph: React.FC<SeasonStatsGraphProps> = ({ seriesId, seasons }) => {
    const api = useApi();

    const validSeasons = useMemo(() => {
        return seasons.filter(s => s.season_number > 0 && s.episode_count > 0);
    }, [seasons]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null); // <-- State pour le swipe
    
    const currentSeason = validSeasons[currentIndex];

    const { data: seasonData, isLoading } = useQuery({
        queryKey: ['tv', seriesId, 'season', currentSeason?.season_number, 'stats'],
        queryFn: () => api.media.getSeasonDetails(seriesId, currentSeason.season_number),
        enabled: !!currentSeason,
        staleTime: Infinity, 
    });

    if (validSeasons.length === 0) return null;

    // --- FONCTIONS DE NAVIGATION AVEC VIBRATION ---
    const handlePrev = () => {
        triggerVibration(10);
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : validSeasons.length - 1));
    };
    
    const handleNext = () => {
        triggerVibration(10);
        setCurrentIndex(prev => (prev < validSeasons.length - 1 ? prev + 1 : 0));
    };

    // --- GESTION DU SWIPE SUR LE GRAPHIQUE ---
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX === null) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;

        // Si on glisse de plus de 50px
        if (diff > 50) {
            handleNext(); // Swipe vers la gauche (Saison suivante)
        } else if (diff < -50) {
            handlePrev(); // Swipe vers la droite (Saison précédente)
        }
        
        setTouchStartX(null); // Reset
    };

    const chartData = useMemo(() => {
        if (!seasonData?.episodes) return [];
        return seasonData.episodes
            .filter(ep => ep.vote_average > 0) 
            .map(ep => ({
                episode: ep.episode_number,
                name: ep.name,
                rating: ep.vote_average / 2, 
            }));
    }, [seasonData]);

    const averageSeasonRating = chartData.length > 0 
        ? chartData.reduce((acc, curr) => acc + curr.rating, 0) / chartData.length 
        : 0;

    return (
        <div className="mb-12 border-t border-zinc-800/50 pt-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <BarChart2 className="text-purple-500" size={20} />
                    <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        Notes par épisode
                    </h2>
                </div>

                {validSeasons.length > 1 && (
                    <div className="flex items-center gap-3 bg-zinc-900/80 rounded-full px-2 py-1 border border-zinc-800">
                        <button onClick={handlePrev} className="p-1 text-zinc-400 hover:text-white transition">
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-xs font-bold text-white min-w-[60px] text-center">
                            Saison {currentSeason.season_number}
                        </span>
                        <button onClick={handleNext} className="p-1 text-zinc-400 hover:text-white transition">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* CONTENEUR DU GRAPHIQUE AVEC TOUCH EVENTS */}
            <div 
                className="w-full h-52 bg-zinc-900/30 rounded-2xl p-4 border border-zinc-800/50 relative select-none"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm animate-pulse">
                        Génération du graphique...
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm italic">
                        Pas assez de notes pour cette saison.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <ReferenceLine 
                                y={averageSeasonRating} 
                                stroke="#52525b" 
                                strokeDasharray="3 3" 
                                opacity={0.5}
                            />
                            
                            <XAxis 
                                dataKey="episode" 
                                stroke="#52525b" 
                                fontSize={10}
                                tickFormatter={(value) => `E${value}`}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            
                            <YAxis 
                                stroke="#52525b" 
                                fontSize={10} 
                                domain={[0, 5]} 
                                tickCount={6}
                                tickLine={false}
                                axisLine={false}
                            />
                            
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '5 5' }} />
                            
                            <Line 
                                type="monotone" 
                                dataKey="rating" 
                                stroke="#a855f7" 
                                strokeWidth={3}
                                dot={{ fill: '#18181b', stroke: '#a855f7', strokeWidth: 2, r: 4 }}
                                activeDot={{ fill: '#a855f7', stroke: '#fff', strokeWidth: 2, r: 6 }}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};
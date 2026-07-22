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
import { triggerVibration } from '../utils/haptics';

interface SeasonStatsGraphProps {
    seriesId: number;
    seasons: any[];
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-xl z-50 transform -translate-y-[130%] transition-opacity min-w-[200px] max-w-[240px]">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    Épisode {data.episode}
                </p>
                <div className="flex items-start justify-between gap-3">
                    <p className="text-white text-sm font-semibold line-clamp-2 flex-1">
                        {data.name}
                    </p>
                    <div className="flex items-center gap-1 text-amber-400 font-bold text-sm shrink-0">
                        <span>⭐️</span> {data.rating.toFixed(1)}
                    </div>
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
    const [isPressing, setIsPressing] = useState(false);

    const currentSeason = validSeasons[currentIndex];

    const { data: seasonData, isLoading } = useQuery({
        queryKey: ['tv', seriesId, 'season', currentSeason?.season_number, 'stats'],
        queryFn: () => api.media.getSeasonDetails(seriesId, currentSeason.season_number),
        enabled: !!currentSeason,
        staleTime: Infinity,
    });

    if (validSeasons.length === 0) return null;

    const handlePrev = () => {
        triggerVibration(10);
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : validSeasons.length - 1));
    };

    const handleNext = () => {
        triggerVibration(10);
        setCurrentIndex(prev => (prev < validSeasons.length - 1 ? prev + 1 : 0));
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
                        <button 
                            onClick={handlePrev} 
                            className="p-1.5 rounded-full text-zinc-400 hover:text-white active:bg-zinc-700 active:text-white active:scale-90 transition-all duration-150"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <span className="text-xs font-bold text-white min-w-[60px] text-center">
                            Saison {currentSeason.season_number}
                        </span>
                        <button 
                            onClick={handleNext} 
                            className="p-1.5 rounded-full text-zinc-400 hover:text-white active:bg-zinc-700 active:text-white active:scale-90 transition-all duration-150"
                        >
                            <ChevronRight size={22} />
                        </button>
                    </div>
                )}
            </div>

            <div
                className="w-full h-52 bg-zinc-900/30 rounded-2xl p-4 border border-zinc-800/50 relative select-none"
                onTouchStart={() => setIsPressing(true)}
                onMouseDown={() => setIsPressing(true)}
                onTouchEnd={() => setIsPressing(false)}
                onTouchCancel={() => setIsPressing(false)}
                onMouseUp={() => setIsPressing(false)}
                onMouseLeave={() => setIsPressing(false)}
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
                    <div className="w-full h-full">
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

                                <Tooltip 
                                    content={(props) => isPressing ? <CustomTooltip {...props} /> : null} 
                                    cursor={isPressing ? { stroke: '#3f3f46', strokeWidth: 1, strokeDasharray: '5 5' } : false}
                                    isAnimationActive={false} 
                                />

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
                    </div>
                )}
            </div>
        </div>
    );
};
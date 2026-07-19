import React from 'react';
import type { TMDBVideo } from '../api/mediaApi';


interface MediaTrailersProps {
    videos?: TMDBVideo[];
}

export const MediaTrailers: React.FC<MediaTrailersProps> = ({ videos }) => {
    // Si pas de vidéos du tout, on ne rend rien
    if (!videos || videos.length === 0) return null;

    // On ne garde que les vidéos YouTube
    const ytVideos = videos.filter(v => v.site === 'YouTube');
    if (ytVideos.length === 0) return null;

    // Tri intelligent : Trailers en premier, puis Teasers, puis le reste
    const trailers = ytVideos.filter(v => v.type === 'Trailer');
    const teasers = ytVideos.filter(v => v.type === 'Teaser');
    const others = ytVideos.filter(v => v.type !== 'Trailer' && v.type !== 'Teaser');

    // On fusionne et on garde seulement les 3 premières vidéos max
    const sortedVideos = [...trailers, ...teasers, ...others].slice(0, 3);
    if (sortedVideos.length === 0) return null;

    const mainVideo = sortedVideos[0];
    const secondaryVideos = sortedVideos.slice(1); // Les vidéos 2 et 3

    return (
        <div className="mb-12 mt-12 border-t border-zinc-800/50 pt-8">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-4">
                Vidéos & Bandes-annonces
            </h2>
            
            <div className="flex flex-col gap-3">
                {/* 1. Vidéo Principale (En grand) */}
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/50 shadow-lg">
                    <iframe
                        src={`https://www.youtube.com/embed/${mainVideo.key}?rel=0`}
                        title={mainVideo.name}
                        className="w-full h-full"
                        allowFullScreen
                        frameBorder="0"
                    ></iframe>
                </div>

                {/* 2. Vidéos Secondaires (Grille de 2 en dessous) */}
                {secondaryVideos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        {secondaryVideos.map(video => (
                            <div key={video.id} className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/50 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                                <iframe
                                    src={`https://www.youtube.com/embed/${video.key}?rel=0`}
                                    title={video.name}
                                    className="w-full h-full"
                                    allowFullScreen
                                    frameBorder="0"
                                ></iframe>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
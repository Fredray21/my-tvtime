import { NavLink } from 'react-router-dom';

export const BottomNav = () => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-900 pb-safe pt-2 px-6 z-50">
            <div className="flex justify-between items-center max-w-md mx-auto h-14">

                {/* Movie Watchlist */}
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-purple-500' : 'text-zinc-500 hover:text-zinc-400'
                        }`
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
                        <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.4-2.2 1.5-2.5l13.5-4c1.1-.3 2.2.4 2.5 1.5l.1.4Z" />
                        <path d="m6.2 5.3 3.1 3.9" />
                        <path d="m12.4 3.4 3.1 4" />
                        <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    </svg>
                    <span className="text-[10px] font-medium tracking-wide">Films</span>
                </NavLink>

                {/* TV Watchlist */}
                <NavLink
                    to="/tv"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-purple-500' : 'text-zinc-500 hover:text-zinc-400'
                        }`
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
                        <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
                        <polyline points="17 2 12 7 7 2" />
                    </svg>
                    <span className="text-[10px] font-medium tracking-wide">Séries</span>
                </NavLink>

                {/* Lien Recherche */}
                <NavLink
                    to="/search"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-purple-500' : 'text-zinc-500 hover:text-zinc-400'
                        }`
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="text-[10px] font-medium tracking-wide">Rechercher</span>
                </NavLink>

                {/* Lien Profil (Pour plus tard) */}
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-purple-500' : 'text-zinc-500 hover:text-zinc-400'
                        }`
                    }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="text-[10px] font-medium tracking-wide">Profil</span>
                </NavLink>

            </div>
        </nav>
    );
};
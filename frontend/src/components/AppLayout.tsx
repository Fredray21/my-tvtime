import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export const AppLayout = () => {
    return (
        <div className="min-h-screen bg-zinc-950">
            <main>
                <Outlet />
            </main>

            <BottomNav />
        </div>
    );
};
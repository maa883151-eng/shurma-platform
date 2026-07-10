import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import RightRail from './RightRail';

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-y-auto min-w-0">
            <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
              <Outlet />
            </div>
          </main>
          <RightRail />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

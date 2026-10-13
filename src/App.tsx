import { NavLink, Route, Routes } from 'react-router-dom';
import { GameProvider, useGame } from './state/game';
import { isSandbox, sandboxOffsetDays } from './core/sandbox';
import TodayPage from './features/today/TodayPage';
import HabitsPage from './features/habits/HabitsPage';
import HabitEditor from './features/habits/HabitEditor';
import HabitDetail from './features/habits/HabitDetail';
import PetPage from './features/pet/PetPage';
import ShopPage from './features/pet/ShopPage';
import SettingsPage from './features/settings/SettingsPage';
import Onboarding from './features/onboarding/Onboarding';
import EventCenter from './features/events/EventCenter';
import PetGallery from './features/dev/PetGallery';
import FoodPage from './features/food/FoodPage';
import AddFoodPage from './features/food/AddFoodPage';
import CustomFoodEditor from './features/food/CustomFoodEditor';
import RecipeEditor from './features/food/RecipeEditor';
import GoalsPage from './features/food/GoalsPage';
import UpdateBanner from './components/UpdateBanner';
import RecapPage from './features/recap/RecapPage';

const TABS = [
  { to: '/', icon: '🏠', label: 'Today', end: true },
  { to: '/habits', icon: '✅', label: 'Habits' },
  { to: '/food', icon: '🍽️', label: 'Food' },
  { to: '/pet', icon: '🦊', label: 'Pet' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

function Shell() {
  const g = useGame();
  if (!g) return <div className="min-h-dvh" />;
  if (!g.pet) return <Onboarding today={g.today} />;

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      {isSandbox() && (
        <div className="sticky top-0 z-40 bg-xp-400 pt-safe text-center text-xs font-bold text-night-950">
          🧪 SANDBOX · day +{sandboxOffsetDays()} · {g.today}
        </div>
      )}
      <main className="px-4 pb-28 pt-safe">
        <div className="pt-4">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/habits/new" element={<HabitEditor />} />
            <Route path="/habits/:id" element={<HabitDetail />} />
            <Route path="/habits/:id/edit" element={<HabitEditor />} />
            <Route path="/food" element={<FoodPage />} />
            <Route path="/food/add" element={<AddFoodPage />} />
            <Route path="/food/goals" element={<GoalsPage />} />
            <Route path="/food/custom/new" element={<CustomFoodEditor />} />
            <Route path="/food/custom/:id" element={<CustomFoodEditor />} />
            <Route path="/food/recipe/new" element={<RecipeEditor />} />
            <Route path="/food/recipe/:id" element={<RecipeEditor />} />
            <Route path="/pet" element={<PetPage />} />
            <Route path="/pet/shop" element={<ShopPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/recap" element={<RecapPage />} />
            {import.meta.env.DEV && <Route path="/dev/pets" element={<PetGallery />} />}
            <Route path="*" element={<TodayPage />} />
          </Routes>
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-night-700 bg-night-900/90 backdrop-blur-md pb-safe">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-ember-400' : 'text-zinc-500'}`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <EventCenter />
      <UpdateBanner />
    </div>
  );
}

import { screen } from '@/state/app';
import { Curtain, Toasts } from './components/Overlays';
import { ModalHost } from './Modals';
import { GameScreen } from './screens/GameScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { MenuScreen } from './screens/MenuScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ShopScreen } from './screens/ShopScreen';

function CurrentScreen() {
  switch (screen.value) {
    case 'loading':
      return (
        <div class="boot">
          <div class="boot__reel" />
        </div>
      );
    case 'menu':
      return <MenuScreen />;
    case 'game':
      return <GameScreen />;
    case 'result':
      return <ResultScreen />;
    case 'shop':
      return <ShopScreen />;
    case 'leaderboard':
      return <LeaderboardScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

export function App() {
  return (
    <div class="hall">
      <div class="hall__drape hall__drape--left" aria-hidden="true" />
      <div class="stage">
        <CurrentScreen />
      </div>
      <div class="hall__drape hall__drape--right" aria-hidden="true" />
      <ModalHost />
      <Curtain />
      <Toasts />
    </div>
  );
}

import { usePetState } from './hooks/usePetState';
import OnboardingScreen from './components/OnboardingScreen';
import GameScreen from './components/GameScreen';

export default function App() {
  const { pet, linkWallet, unlinkWallet, resetPet, play, toggleSleep, wallet } = usePetState();

  return (
    <div className="app-shell">
      {pet ? (
        <GameScreen
          pet={pet}
          balanceSats={wallet.balanceSats}
          walletLoading={wallet.loading}
          walletError={wallet.error}
          lastCheckedAt={wallet.lastCheckedAt}
          onPlay={play}
          onToggleSleep={toggleSleep}
          onRefresh={wallet.refresh}
          onUnlink={unlinkWallet}
          onReset={resetPet}
        />
      ) : (
        <OnboardingScreen onLink={linkWallet} />
      )}
    </div>
  );
}

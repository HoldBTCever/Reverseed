import { usePetState } from './hooks/usePetState';
import OnboardingScreen from './components/OnboardingScreen';
import GameScreen from './components/GameScreen';

export default function App() {
  const { pet, linked, linkWallet, unlinkWallet, resetPet, play, wallet, feedManually, requestHabit, cancelHabitRequest } =
    usePetState();

  return (
    <div className="app-shell">
      {pet && linked ? (
        <GameScreen
          pet={pet}
          linked={linked}
          balanceSats={wallet.balanceSats}
          walletLoading={wallet.loading}
          walletError={wallet.error}
          lastCheckedAt={wallet.lastCheckedAt}
          onPlay={play}
          onRefresh={wallet.refresh}
          onUnlink={unlinkWallet}
          onReset={resetPet}
          onFeed={feedManually}
          onRequestHabit={requestHabit}
          onCancelHabit={cancelHabitRequest}
        />
      ) : (
        <OnboardingScreen onLink={linkWallet} />
      )}
    </div>
  );
}

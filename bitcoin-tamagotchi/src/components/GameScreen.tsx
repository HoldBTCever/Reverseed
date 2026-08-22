import { hasHabitBadge, moodFor, stageForTotalSats } from '../lib/petEngine';
import type { HabitKind, LinkedWallet, PetState } from '../types';
import PetSprite from './PetSprite';
import StatBar from './StatBar';
import AddressCard from './AddressCard';
import LightningCard from './LightningCard';
import FeedLog from './FeedLog';
import ActionBar from './ActionBar';
import TopHeader from './TopHeader';

interface GameScreenProps {
  pet: PetState;
  linked: LinkedWallet;
  balanceSats: number | null;
  walletLoading: boolean;
  walletError: string | null;
  lastCheckedAt: number | null;
  onPlay: () => void;
  onToggleSleep: () => void;
  onRefresh: () => void;
  onUnlink: () => void;
  onReset: () => void;
  onFeed: (id: string, sats: number) => void;
  onHabit: (kind: HabitKind) => void;
}

const STATUS_MESSAGE: Record<string, string> = {
  hibernating: '😴 Seu avatar voltou a viver no curto prazo por falta de aportes. Envie mais sats e ele retoma o rumo.',
  gone: '💔 Depois de dias sem aportes, seu avatar recaiu de vez no sistema fiduciário. Comece de novo com a mesma carteira.',
};

export default function GameScreen({
  pet,
  linked,
  balanceSats,
  walletLoading,
  walletError,
  lastCheckedAt,
  onPlay,
  onToggleSleep,
  onRefresh,
  onUnlink,
  onReset,
  onFeed,
  onHabit,
}: GameScreenProps) {
  const stage = stageForTotalSats(pet.totalSatsFed);
  const mood = moodFor(pet);
  const isInteractive = pet.status === 'alive';
  const habitBadges = {
    carnivore: hasHabitBadge(pet, 'carnivore'),
    austrianSchool: hasHabitBadge(pet, 'austrianSchool'),
    gym: hasHabitBadge(pet, 'gym'),
  };

  return (
    <div className="game-screen">
      <TopHeader
        petName={pet.name}
        stageName={stage.name}
        stageDescription={stage.description}
        walletKind={pet.walletKind}
        onUnlink={onUnlink}
        onReset={onReset}
      />

      <div className="device-shell">
        <div className="device-screen">
          <PetSprite stageId={stage.id} mood={mood} habitBadges={habitBadges} />
          {pet.isSleeping && pet.status === 'alive' && <p className="device-screen__hint">Zzz… dormindo para recuperar energia</p>}
          {STATUS_MESSAGE[pet.status] && <p className="device-screen__alert">{STATUS_MESSAGE[pet.status]}</p>}
        </div>

        <div className="device-stats">
          <StatBar label="Fome" icon="🍗" value={pet.hunger} />
          <StatBar label="Felicidade" icon="💛" value={pet.happiness} />
          <StatBar label="Energia" icon="⚡" value={pet.energy} />
          <StatBar label="Saúde" icon="❤️" value={pet.health} />
        </div>

        <ActionBar
          disabled={!isInteractive}
          isSleeping={pet.isSleeping}
          onPlay={onPlay}
          onToggleSleep={onToggleSleep}
          onRefresh={onRefresh}
          onHabit={onHabit}
          refreshing={walletLoading}
        />
      </div>

      {pet.walletKind === 'onchain' ? (
        <AddressCard address={pet.walletLabel} isDemo={pet.isDemo} balanceSats={balanceSats} />
      ) : (
        <LightningCard
          walletLabel={pet.walletLabel}
          isDemo={pet.isDemo}
          lightningAddress={linked.kind === 'lightning' && !linked.isDemo ? linked.lightningAddress : null}
          balanceSats={balanceSats}
          onFeed={onFeed}
        />
      )}

      {walletError && <p className="onboarding__error">⚠️ {walletError}</p>}
      {lastCheckedAt && !walletError && (
        <p className="game-screen__synced">Última checagem: {new Date(lastCheckedAt).toLocaleTimeString('pt-BR')}</p>
      )}

      <section>
        <h2 className="feed-log__title">Total alimentado: {pet.totalSatsFed.toLocaleString('pt-BR')} sats</h2>
        <FeedLog events={pet.feedLog} />
      </section>
    </div>
  );
}

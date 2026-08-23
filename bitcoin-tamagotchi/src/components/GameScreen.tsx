import { useEffect, useRef, useState } from 'react';
import {
  describeEffects,
  feedEffectDeltas,
  HABIT_INFO,
  HABIT_STAT_EFFECTS,
  hasHabitBadge,
  isNightInBrazil,
  moodFor,
  stageForTotalSats,
} from '../lib/petEngine';
import type { HabitKind, LinkedWallet, PetState } from '../types';
import PetSprite from './PetSprite';
import StatBar from './StatBar';
import AddressCard from './AddressCard';
import LightningCard from './LightningCard';
import HabitPaymentCard from './HabitPaymentCard';
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
  onRefresh: () => void;
  onUnlink: () => void;
  onReset: () => void;
  onFeed: (id: string, sats: number) => void;
  onRequestHabit: (kind: HabitKind) => void;
  onCancelHabit: () => void;
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
  onRefresh,
  onUnlink,
  onReset,
  onFeed,
  onRequestHabit,
  onCancelHabit,
}: GameScreenProps) {
  const stage = stageForTotalSats(pet.totalSatsFed);
  const mood = moodFor(pet);
  const isInteractive = pet.status === 'alive';
  const habitBadges = {
    carnivore: hasHabitBadge(pet, 'carnivore'),
    austrianSchool: hasHabitBadge(pet, 'austrianSchool'),
    gym: hasHabitBadge(pet, 'gym'),
  };
  const now = Date.now();
  const isNight = isNightInBrazil(now);
  const brasiliaTime = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(now);

  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // A habit only completes once its cost is actually received — that can happen
  // synchronously (confirming a Lightning invoice, below) or asynchronously (an
  // on-chain/demo payment detected by the wallet-sync poll). Detect the latter
  // here so both paths get the same completion feedback.
  const prevPendingRef = useRef(pet.pendingHabit);
  const prevHabitsRef = useRef(pet.habits);
  useEffect(() => {
    const prevPending = prevPendingRef.current;
    if (prevPending && !pet.pendingHabit && pet.habits[prevPending.kind] > prevHabitsRef.current[prevPending.kind]) {
      const info = HABIT_INFO[prevPending.kind];
      const sats = pet.feedLog[0]?.sats;
      const satsText = sats ? `+${sats.toLocaleString('pt-BR')} sats · ` : '';
      showToast(`${info.icon} ${info.label} concluído! ${satsText}${describeEffects(HABIT_STAT_EFFECTS[prevPending.kind])}`);
    }
    prevPendingRef.current = pet.pendingHabit;
    prevHabitsRef.current = pet.habits;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet.pendingHabit, pet.habits, pet.feedLog]);

  const handleFeed = (id: string, sats: number) => {
    const willCompleteHabit = pet.pendingHabit !== null && sats >= pet.pendingHabit.costSats;
    if (!willCompleteHabit) {
      const deltas = feedEffectDeltas(sats, pet.status === 'hibernating');
      showToast(`+${sats.toLocaleString('pt-BR')} sats · ${describeEffects(deltas)}`);
    }
    onFeed(id, sats);
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
          <div key={toast?.key ?? 'idle'} className={`avatar-frame ${toast ? 'avatar-frame--pulse' : ''}`}>
            <PetSprite
              stageId={stage.id}
              mood={mood}
              habitBadges={habitBadges}
              physicalHealth={pet.physicalHealth}
              intelligence={pet.intelligence}
              isSleeping={isNight && isInteractive}
            />
            {toast && <p className="feedback-toast">{toast.text}</p>}
          </div>
          <p className="device-screen__clock">
            {isNight ? '🌙' : '☀️'} {brasiliaTime} (Brasília) {isNight && isInteractive ? '· dormindo' : ''}
          </p>
          {STATUS_MESSAGE[pet.status] && <p className="device-screen__alert">{STATUS_MESSAGE[pet.status]}</p>}
        </div>

        <div className="device-stats">
          <StatBar label="Fome" icon="🍗" value={pet.hunger} />
          <StatBar label="Felicidade" icon="💛" value={pet.happiness} />
          <StatBar label="Energia" icon="⚡" value={pet.energy} />
          <StatBar label="Saúde Física" icon="💪" value={pet.physicalHealth} />
          <StatBar label="Saúde Mental" icon="🧘" value={pet.mentalHealth} />
          <StatBar label="Inteligência" icon="🧠" value={pet.intelligence} />
        </div>

        <ActionBar
          disabled={!isInteractive}
          habitsDisabled={pet.pendingHabit !== null}
          onPlay={onPlay}
          onRefresh={onRefresh}
          onRequestHabit={onRequestHabit}
          refreshing={walletLoading}
        />
      </div>

      {pet.pendingHabit ? (
        <HabitPaymentCard
          pendingHabit={pet.pendingHabit}
          walletKind={pet.walletKind}
          isDemo={pet.isDemo}
          lightningAddress={linked.kind === 'lightning' && !linked.isDemo ? linked.lightningAddress : null}
          address={pet.walletKind === 'onchain' && !pet.isDemo ? pet.walletLabel : null}
          onFeed={handleFeed}
          onCancel={onCancelHabit}
        />
      ) : pet.walletKind === 'onchain' ? (
        <AddressCard address={pet.walletLabel} isDemo={pet.isDemo} balanceSats={balanceSats} />
      ) : (
        <LightningCard
          walletLabel={pet.walletLabel}
          isDemo={pet.isDemo}
          lightningAddress={linked.kind === 'lightning' && !linked.isDemo ? linked.lightningAddress : null}
          balanceSats={balanceSats}
          onFeed={handleFeed}
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

import { useEffect, useRef, useState } from 'react';
import {
  describeEffects,
  feedEffectDeltas,
  HABIT_COOLDOWN_MS,
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

  const handleFeed = (id: string, sats: number) => {
    const deltas = feedEffectDeltas(sats, pet.status === 'hibernating');
    showToast(`+${sats.toLocaleString('pt-BR')} sats · ${describeEffects(deltas)}`);
    onFeed(id, sats);
  };

  const handleHabit = (kind: HabitKind) => {
    const last = pet.lastHabitAt[kind];
    const onCooldown = last !== null && Date.now() - last < HABIT_COOLDOWN_MS;
    showToast(
      onCooldown
        ? `⏳ ${HABIT_INFO[kind].label}: espere um pouco antes de repetir.`
        : describeEffects(HABIT_STAT_EFFECTS[kind]),
    );
    onHabit(kind);
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

        <ActionBar disabled={!isInteractive} onPlay={onPlay} onRefresh={onRefresh} onHabit={handleHabit} refreshing={walletLoading} />
      </div>

      {pet.walletKind === 'onchain' ? (
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

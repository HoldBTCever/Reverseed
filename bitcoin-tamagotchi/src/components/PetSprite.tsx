import { INTELLIGENCE_GLASSES_THRESHOLD } from '../lib/petEngine';
import type { Mood } from '../types';

interface HabitBadgeState {
  carnivore: boolean;
  austrianSchool: boolean;
  gym: boolean;
}

interface PetSpriteProps {
  stageId: number;
  mood: Mood;
  habitBadges?: HabitBadgeState;
  physicalHealth?: number;
  intelligence?: number;
  isSleeping?: boolean;
}

interface StageStyle {
  fill: string;
  glow?: string;
  scale: number;
}

const STAGE_STYLES: Record<number, StageStyle> = {
  0: { fill: '#8d8d99', scale: 0.9 },
  1: { fill: '#f7931a', scale: 0.94 },
  2: { fill: '#2fb8a6', scale: 0.98 },
  3: { fill: '#8a5cf6', scale: 1.02 },
  4: { fill: '#3b82f6', scale: 1.06 },
  5: { fill: '#f7c948', glow: '#f7931a', scale: 1.12 },
};

const HABIT_BADGE_ORDER: { key: keyof HabitBadgeState; icon: string }[] = [
  { key: 'carnivore', icon: '🥩' },
  { key: 'austrianSchool', icon: '📖' },
  { key: 'gym', icon: '💪' },
];

const SLEEP_FACE = (
  <g>
    <path d="M84 60 Q90 60 96 60" stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" />
    <path d="M104 60 Q110 60 116 60" stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" />
    <path d="M92 77 Q100 74 108 77" stroke="#1a1a2e" strokeWidth={3} fill="none" strokeLinecap="round" />
    <text x="120" y="44" fontSize="12" fill="#1a1a2e" fontWeight={700}>z</text>
  </g>
);

function Face({ mood, isSleeping }: { mood: Mood; isSleeping: boolean }) {
  if (isSleeping && mood !== 'hibernating' && mood !== 'gone') return SLEEP_FACE;

  switch (mood) {
    case 'happy':
      return (
        <g stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" fill="none">
          <path d="M84 60 Q90 54 96 60" />
          <path d="M104 60 Q110 54 116 60" />
          <path d="M87 72 Q100 82 113 72" />
        </g>
      );
    case 'neutral':
      return (
        <g>
          <circle cx="90" cy="60" r="2.6" fill="#1a1a2e" />
          <circle cx="110" cy="60" r="2.6" fill="#1a1a2e" />
          <path d="M90 76 Q100 80 110 76" stroke="#1a1a2e" strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'sad':
      return (
        <g stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" fill="none">
          <path d="M84 62 Q90 58 96 62" />
          <path d="M104 62 Q110 58 116 62" />
          <path d="M88 80 Q100 71 112 80" />
          <path d="M83 66 L80 74" stroke="#5cc2ff" />
          <path d="M117 66 L120 74" stroke="#5cc2ff" />
        </g>
      );
    case 'critical':
      return (
        <g stroke="#1a1a2e" strokeWidth={2.6} strokeLinecap="round">
          <path d="M85 56 L93 64 M93 56 L85 64" />
          <path d="M107 56 L115 64 M115 56 L107 64" />
          <path d="M88 78 Q100 72 112 78" fill="none" />
        </g>
      );
    case 'hibernating':
      return (
        <g>
          <path d="M84 60 Q90 60 96 60" stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" />
          <path d="M104 60 Q110 60 116 60" stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" />
          <path d="M92 77 Q100 74 108 77" stroke="#1a1a2e" strokeWidth={3} fill="none" strokeLinecap="round" />
          <text x="118" y="46" fontSize="14" fill="#1a1a2e" fontWeight={700}>Zzz</text>
        </g>
      );
    case 'gone':
      return (
        <g stroke="#1a1a2e" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3 4" fill="none">
          <path d="M85 57 L93 63 M93 57 L85 63" />
          <path d="M107 57 L115 63 M115 57 L107 63" />
          <path d="M89 80 Q100 86 111 80" />
        </g>
      );
    default:
      return null;
  }
}

export default function PetSprite({
  stageId,
  mood,
  habitBadges,
  physicalHealth = 70,
  intelligence = 40,
  isSleeping = false,
}: PetSpriteProps) {
  const style = STAGE_STYLES[stageId] ?? STAGE_STYLES[0];
  const isDormant = stageId === 0;
  const isGone = mood === 'gone';
  const hasHouse = stageId >= 3;
  const hasFamily = stageId >= 4;
  const hasGlasses = intelligence >= INTELLIGENCE_GLASSES_THRESHOLD;

  // Broader shoulders/torso as physicalHealth rises — "mais musculoso".
  const bottomHalfWidth = 50 + physicalHealth * 0.15;
  const topHalfWidth = 34 + physicalHealth * 0.08;
  const torsoPath = `M${100 - bottomHalfWidth} 178 L${100 - topHalfWidth} 94 Q100 78 ${100 + topHalfWidth} 94 L${100 + bottomHalfWidth} 178 Z`;

  return (
    <svg
      viewBox="0 0 200 200"
      width="180"
      height="180"
      role="img"
      aria-label={isDormant ? 'Ainda dormindo no sistema fiduciário' : `Avatar no humor ${mood}`}
      style={{
        filter: style.glow ? `drop-shadow(0 0 18px ${style.glow})` : undefined,
        opacity: isGone ? 0.5 : 1,
        transform: `scale(${style.scale})`,
        transition: 'transform 400ms ease, filter 400ms ease',
      }}
    >
      {hasHouse && (
        <text x="150" y="46" fontSize="26" textAnchor="middle">🏠</text>
      )}

      {/* Torso */}
      <path d={torsoPath} fill={style.fill} stroke="#1a1a2e" strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx="100" cy="182" rx="62" ry="10" fill="#1a1a2e" opacity={0.08} />

      {/* Head + face, tilted while still dormant */}
      <g transform={isDormant ? 'rotate(10 100 66)' : undefined}>
        <circle cx="100" cy="66" r="26" fill="#f2c9a0" stroke="#1a1a2e" strokeWidth={3} />
        {isDormant ? SLEEP_FACE : <Face mood={mood} isSleeping={isSleeping} />}
        {hasGlasses && (
          <g stroke="#1a1a2e" strokeWidth={2} fill="none" opacity={0.85}>
            <circle cx="90" cy="60" r="9" />
            <circle cx="110" cy="60" r="9" />
            <path d="M99 60 L101 60" />
            <path d="M81 58 L74 55" />
            <path d="M119 58 L126 55" />
          </g>
        )}
      </g>

      {hasFamily && (
        <>
          <text x="26" y="182" fontSize="22" textAnchor="middle">👩</text>
          <text x="174" y="186" fontSize="18" textAnchor="middle">🧒</text>
        </>
      )}

      {habitBadges && (
        <g>
          {HABIT_BADGE_ORDER.map((badge, i) => (
            <text
              key={badge.key}
              x={78 + i * 22}
              y="196"
              fontSize="15"
              textAnchor="middle"
              opacity={habitBadges[badge.key] ? 1 : 0.18}
            >
              {badge.icon}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

import type { Mood } from '../types';

interface PetSpriteProps {
  stageId: number;
  mood: Mood;
}

interface StageStyle {
  fill: string;
  glow?: string;
  scale: number;
}

const STAGE_STYLES: Record<number, StageStyle> = {
  0: { fill: '#8d8d99', scale: 0.78 },
  1: { fill: '#f7931a', scale: 0.85 },
  2: { fill: '#2fb8a6', scale: 0.92 },
  3: { fill: '#8a5cf6', scale: 0.98 },
  4: { fill: '#3b82f6', scale: 1.05 },
  5: { fill: '#f7c948', glow: '#f7931a', scale: 1.12 },
};

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <g stroke="#1a1a2e" strokeWidth={4} strokeLinecap="round" fill="none">
          <path d="M72 96 Q80 84 88 96" />
          <path d="M112 96 Q120 84 128 96" />
          <path d="M76 112 Q100 132 124 112" />
        </g>
      );
    case 'neutral':
      return (
        <g fill="#1a1a2e">
          <circle cx="80" cy="94" r="5" />
          <circle cx="120" cy="94" r="5" />
          <path d="M84 116 Q100 122 116 116" stroke="#1a1a2e" strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      );
    case 'sad':
      return (
        <g stroke="#1a1a2e" strokeWidth={4} strokeLinecap="round" fill="none">
          <path d="M72 98 Q80 90 88 98" />
          <path d="M112 98 Q120 90 128 98" />
          <path d="M78 122 Q100 108 122 122" />
          <path d="M74 104 L70 116" stroke="#5cc2ff" />
          <path d="M126 104 L130 116" stroke="#5cc2ff" />
        </g>
      );
    case 'critical':
      return (
        <g stroke="#1a1a2e" strokeWidth={4} strokeLinecap="round">
          <path d="M74 88 L90 100 M90 88 L74 100" />
          <path d="M110 88 L126 100 M126 88 L110 100" />
          <path d="M80 122 Q100 112 120 122" fill="none" />
        </g>
      );
    case 'hibernating':
      return (
        <g>
          <path d="M74 94 Q82 94 88 94" stroke="#1a1a2e" strokeWidth={4} strokeLinecap="round" />
          <path d="M112 94 Q120 94 128 94" stroke="#1a1a2e" strokeWidth={4} strokeLinecap="round" />
          <path d="M86 116 Q100 112 114 116" stroke="#1a1a2e" strokeWidth={4} fill="none" strokeLinecap="round" />
          <text x="128" y="70" fontSize="22" fill="#1a1a2e" fontWeight={700}>Zzz</text>
        </g>
      );
    case 'gone':
      return (
        <g stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" strokeDasharray="4 5" fill="none">
          <path d="M74 90 L90 104 M90 90 L74 104" />
          <path d="M110 90 L126 104 M126 90 L110 104" />
          <path d="M80 120 Q100 130 120 120" />
        </g>
      );
    default:
      return null;
  }
}

export default function PetSprite({ stageId, mood }: PetSpriteProps) {
  const style = STAGE_STYLES[stageId] ?? STAGE_STYLES[0];
  const isEgg = stageId === 0;
  const isGone = mood === 'gone';

  return (
    <svg
      viewBox="0 0 200 200"
      width="180"
      height="180"
      role="img"
      aria-label={isEgg ? 'Ovo ainda não chocado' : `Pet no humor ${mood}`}
      style={{
        filter: style.glow ? `drop-shadow(0 0 18px ${style.glow})` : undefined,
        opacity: isGone ? 0.5 : 1,
        transform: `scale(${style.scale})`,
        transition: 'transform 400ms ease, filter 400ms ease',
      }}
    >
      {isEgg ? (
        <g>
          <ellipse cx="100" cy="108" rx="52" ry="66" fill={style.fill} stroke="#1a1a2e" strokeWidth={3} />
          <path
            d="M78 70 L92 96 L80 106 L104 138"
            fill="none"
            stroke="#1a1a2e"
            strokeOpacity={0.35}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g>
          <ellipse cx="100" cy="112" rx="58" ry="52" fill={style.fill} stroke="#1a1a2e" strokeWidth={3} />
          <ellipse cx="100" cy="150" rx="40" ry="14" fill="#1a1a2e" opacity={0.08} />
          <Face mood={mood} />
        </g>
      )}
    </svg>
  );
}

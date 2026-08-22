import type { FeedEvent } from '../types';

function formatSats(sats: number): string {
  return `${sats.toLocaleString('pt-BR')} sats`;
}

function formatWhen(at: number): string {
  const diffMs = Date.now() - at;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export default function FeedLog({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="feed-log__empty">
        Nenhuma refeição ainda. Envie sats para a carteira vinculada para alimentar seu pet.
      </p>
    );
  }

  return (
    <ul className="feed-log">
      {events.slice(0, 8).map((event) => (
        <li key={event.txid} className="feed-log__item">
          <span className="feed-log__amount">🍖 {formatSats(event.sats)}</span>
          <span className="feed-log__when">{formatWhen(event.at)}</span>
        </li>
      ))}
    </ul>
  );
}

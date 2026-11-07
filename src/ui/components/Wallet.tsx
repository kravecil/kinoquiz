import { formatDuration, formatNumber, t } from '@/i18n';
import { save } from '@/state/app';
import { ticketView } from '@/state/economy';
import { IconInfinity, IconTicket, IconToken } from '../icons';

/** Билеты и жетоны игрока — показываются в шапке на всех экранах. */
export function Wallet({ compact = false }: { compact?: boolean }) {
  const tv = ticketView.value;
  const coins = save.value?.coins ?? 0;
  const timer =
    tv.unlimitedMs > 0
      ? t('tickets.unlimited', { time: formatDuration(tv.unlimitedMs) })
      : tv.nextMs > 0
        ? formatDuration(tv.nextMs)
        : null;

  return (
    <div class="wallet">
      <div
        class={`wallet__item wallet__tickets${tv.count === 0 && tv.unlimitedMs === 0 ? ' is-empty' : ''}`}
        title={t('tickets.label')}
      >
        <IconTicket size={20} />
        {tv.unlimitedMs > 0 ? <IconInfinity size={20} /> : <b data-testid="tickets">{tv.count}</b>}
        {!compact && timer && <span class="wallet__timer">{timer}</span>}
      </div>
      <div class="wallet__item wallet__coins">
        <IconToken size={20} />
        <b data-testid="coins">{formatNumber(coins)}</b>
      </div>
    </div>
  );
}

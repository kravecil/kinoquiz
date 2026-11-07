import { formatDuration, t } from '@/i18n';
import { config, modal, navigate } from '@/state/app';
import { showRewarded } from '@/state/ads';
import { giveTickets, ticketView } from '@/state/economy';
import { endRun, isRunActive, reviveWithAd } from '@/state/run';
import { play } from '@/audio/sfx';
import { Modal } from './components/Overlays';
import { IconTicket, IconVideo } from './icons';

export function ModalHost() {
  const m = modal.value;
  if (!m) return null;
  const close = () => (modal.value = null);

  switch (m.kind) {
    case 'noTickets':
      return (
        <Modal title={t('tickets.empty.title')}>
          <p class="modal__text">{t('tickets.empty.text', { time: formatDuration(ticketView.value.nextMs) })}</p>
          <div class="modal__actions">
            <button
              class="ticket-btn"
              data-testid="ticket-for-ad"
              onClick={async () => {
                if (!(await showRewarded())) return;
                giveTickets(config.tickets.perAd);
                play('coin');
                close();
              }}
            >
              <IconVideo size={20} />
              {t('tickets.empty.ad')}
            </button>
            <button
              class="brass-btn"
              onClick={() => {
                close();
                navigate('shop', { returnTo: 'menu' });
              }}
            >
              <IconTicket size={20} />
              {t('tickets.empty.shop')}
            </button>
            <button class="ghost-btn" onClick={close}>
              {t('common.close')}
            </button>
          </div>
        </Modal>
      );

    case 'revive':
      return (
        <Modal title={t('revive.title')}>
          <p class="modal__text">{t('revive.text')}</p>
          <div class="modal__actions">
            <button class="ticket-btn" data-testid="revive-ad" onClick={() => void reviveWithAd()}>
              <IconVideo size={20} />
              {t('revive.ad')}
            </button>
            <button
              class="brass-btn"
              onClick={() => {
                modal.value = null;
                navigate('shop', { returnTo: 'game' });
              }}
            >
              <IconTicket size={20} />
              {t('revive.shop')}
            </button>
            <button class="ghost-btn" data-testid="revive-end" onClick={() => void endRun()}>
              {t('revive.end')}
            </button>
          </div>
        </Modal>
      );

    case 'exitRun':
      return (
        <Modal title={t('game.exit.confirm')}>
          <div class="modal__actions">
            <button class="ticket-btn" onClick={close}>
              {t('game.exit.no')}
            </button>
            <button
              class="ghost-btn"
              data-testid="exit-confirm"
              onClick={() => {
                if (isRunActive()) void endRun();
                else close();
              }}
            >
              {t('game.exit.yes')}
            </button>
          </div>
        </Modal>
      );
  }
}

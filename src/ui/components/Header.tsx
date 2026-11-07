import type { ComponentChildren } from 'preact';
import { t } from '@/i18n';
import { IconBack } from '../icons';
import { Wallet } from './Wallet';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  left?: ComponentChildren;
  compactWallet?: boolean;
}

export function Header({ title, onBack, left, compactWallet }: HeaderProps) {
  return (
    <header class="header">
      <div class="header__left">
        {onBack && (
          <button class="icon-btn" onClick={onBack} aria-label={t('common.back')}>
            <IconBack />
          </button>
        )}
        {left}
        {title && <h1 class="header__title">{title}</h1>}
      </div>
      <Wallet compact={compactWallet} />
    </header>
  );
}

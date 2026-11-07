import { LANGUAGES, t } from '@/i18n';
import { goBack, save } from '@/state/app';
import { chooseLanguage, toggleSound } from '@/state/boot';
import { Header } from '../components/Header';

export function SettingsScreen() {
  const s = save.value;
  if (!s) return null;
  const langChoice = s.settings.lang;

  return (
    <div class="screen screen--settings">
      <Header title={t('settings.title')} onBack={goBack} />
      <main class="settings">
        <div class="setting">
          <span class="setting__label">{t('settings.sound')}</span>
          <button
            class={`switch${s.settings.sound ? ' is-on' : ''}`}
            role="switch"
            aria-checked={s.settings.sound}
            onClick={toggleSound}
          >
            <span class="switch__knob" />
            <span class="switch__text">{s.settings.sound ? t('settings.on') : t('settings.off')}</span>
          </button>
        </div>

        <div class="setting setting--column">
          <span class="setting__label">{t('settings.language')}</span>
          <div class="segmented" role="radiogroup">
            <button
              role="radio"
              aria-checked={langChoice === null}
              class={langChoice === null ? 'is-active' : ''}
              onClick={() => void chooseLanguage(null)}
            >
              {t('settings.auto')}
            </button>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                role="radio"
                aria-checked={langChoice === l.code}
                class={langChoice === l.code ? 'is-active' : ''}
                data-testid={`lang-${l.code}`}
                onClick={() => void chooseLanguage(l.code)}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        <p class="settings__about">{t('settings.about')}</p>
      </main>
    </div>
  );
}

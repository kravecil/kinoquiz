import { render } from 'preact';
import '@fontsource/poiret-one/cyrillic-400.css';
import '@fontsource/poiret-one/latin-400.css';
import '@fontsource-variable/manrope/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import { App } from './ui/App';
import { boot } from './state/boot';

const root = document.getElementById('app')!;
render(<App />, root);

boot().catch((err) => {
  console.error('[boot]', err);
  root.innerHTML = '<p style="padding:24px;color:#ebcb83;font-family:sans-serif">Не удалось запустить игру. Обновите страницу.</p>';
});

// Запрет контекстного меню и выделения — частые требования площадок к играм.
document.addEventListener('contextmenu', (e) => e.preventDefault());

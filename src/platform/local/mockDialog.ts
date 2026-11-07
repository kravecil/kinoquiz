/**
 * Простое модальное окно поверх игры — имитирует интерфейс площадки
 * (рекламу, окно оплаты, вход). Используется только в LocalPlatform.
 */
interface MockDialogOptions {
  title: string;
  text: string;
  buttons?: Array<{ id: string; label: string }>;
  autoCloseMs?: number;
}

export function showMockDialog(opts: MockDialogOptions): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-mock-dialog', '');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(0,0,0,.82);font:16px system-ui,sans-serif;color:#fff';

    const box = document.createElement('div');
    box.style.cssText =
      'width:min(340px,90vw);padding:24px;border:2px dashed #888;border-radius:12px;background:#222;text-align:center';

    const badge = document.createElement('div');
    badge.textContent = 'MOCK · ' + opts.title;
    badge.style.cssText = 'font-size:12px;letter-spacing:.1em;color:#aaa;margin-bottom:12px';

    const text = document.createElement('p');
    text.textContent = opts.text;
    text.style.cssText = 'margin:0 0 20px';

    box.append(badge, text);

    const close = (id: string) => {
      overlay.remove();
      resolve(id);
    };

    for (const b of opts.buttons ?? []) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.dataset.mockButton = b.id;
      btn.style.cssText =
        'margin:4px;padding:10px 18px;border-radius:8px;border:0;background:#555;color:#fff;font:inherit;cursor:pointer';
      btn.onclick = () => close(b.id);
      box.append(btn);
    }

    overlay.append(box);
    document.body.append(overlay);

    if (opts.autoCloseMs) setTimeout(() => close('auto'), opts.autoCloseMs);
  });
}

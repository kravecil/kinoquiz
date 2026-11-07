import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { toasts } from '@/state/app';
import { runId } from '@/state/run';

export function Modal({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div class="modal__card">
        <h2 class="modal__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map((toast) => (
        <div key={toast.id} class={`toast toast--${toast.tone}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}

/** Занавес раскрывается в начале каждого сеанса — единственная «большая» анимация игры. */
export function Curtain() {
  const id = runId.value;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (id === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(timer);
  }, [id]);

  if (!visible) return null;
  return (
    <div class="curtain" key={id} aria-hidden="true">
      <div class="curtain__half curtain__half--left" />
      <div class="curtain__half curtain__half--right" />
    </div>
  );
}

/** Вывеска кинотеатра с лампочками по периметру. */
export function Marquee({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div class="marquee">
      <div class="marquee__bulbs" aria-hidden="true" />
      <div class="marquee__board">
        <h1 class="marquee__title">{title}</h1>
        {subtitle && <p class="marquee__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

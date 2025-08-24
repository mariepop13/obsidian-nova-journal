import type { Plugin } from 'obsidian';

const handleDeepenClick = (
  btn: Element,
  getLabel: () => string,
  deepenLine: (line: number) => Promise<void>,
  deepenNote: (label: string) => Promise<void>
): void => {
  const lineAttr = btn.getAttribute('data-line');
  const scope = btn.getAttribute('data-scope') ?? '';
  const label = btn.textContent ?? getLabel();
  const parsed = lineAttr !== null ? Number(lineAttr) : undefined;
  const hasValidLine = typeof parsed === 'number' && Number.isFinite(parsed);
  if (scope === 'note' || !hasValidLine) deepenNote(label).catch((): void => {});
  else deepenLine(parsed as number).catch((): void => {});
};

const handleMoodClick = (analyzeMood: () => Promise<void>): void => {
  analyzeMood().catch((): void => {});
};

export function registerDeepenHandlers(
  plugin: Plugin,
  getLabel: () => string,
  deepenLine: (line: number) => Promise<void>,
  deepenNote: (label: string) => Promise<void>,
  analyzeMood?: () => Promise<void>
): void {
  plugin.registerMarkdownPostProcessor((el): void => {
    el.querySelectorAll('a.nova-deepen, button.nova-deepen').forEach((btn): void => {
      btn.addEventListener('click', (evt): void => {
        evt.preventDefault();
        handleDeepenClick(btn, getLabel, deepenLine, deepenNote);
      });
    });

    if (analyzeMood) {
      el.querySelectorAll('button.nova-mood-analyze').forEach((btn): void => {
        btn.addEventListener('click', (evt): void => {
          evt.preventDefault();
          handleMoodClick(analyzeMood);
        });
      });
    }
  });

  plugin.registerDomEvent(document, 'click', (evt: MouseEvent): void => {
    const target = evt.target as HTMLElement | null;
    if (!target) return;
    
    const deepenBtn = target.closest('a.nova-deepen, button.nova-deepen');
    const moodBtn = target.closest('button.nova-mood-analyze');

    if (deepenBtn) {
      evt.preventDefault();
      handleDeepenClick(deepenBtn, getLabel, deepenLine, deepenNote);
    } else if (moodBtn && analyzeMood) {
      evt.preventDefault();
      handleMoodClick(analyzeMood);
    }
  });
}

import type { Plugin } from 'obsidian';

export function registerDeepenHandlers(
  plugin: Plugin,
  getLabel: () => string,
  deepenLine: (line: number) => Promise<void>,
  deepenNote: (label: string) => Promise<void>,
  analyzeMood?: () => Promise<void>
) {
  plugin.registerMarkdownPostProcessor(el => {
    el.querySelectorAll('a.nova-deepen, button.nova-deepen').forEach(btn => {
      btn.addEventListener('click', evt => {
        evt.preventDefault();
        const lineAttr = btn.getAttribute('data-line');
        const scope = btn.getAttribute('data-scope') ?? '';
        const label = btn.textContent ?? getLabel();
        const parsed = lineAttr !== null ? Number(lineAttr) : undefined;
        const hasValidLine = typeof parsed === 'number' && Number.isFinite(parsed);
        if (scope === 'note' || !hasValidLine) deepenNote(label).catch(() => {});
        else deepenLine(parsed as number).catch(() => {});
      });
    });

    if (analyzeMood) {
      el.querySelectorAll('button.nova-mood-analyze').forEach(btn => {
        btn.addEventListener('click', evt => {
          evt.preventDefault();
          analyzeMood().catch(() => {});
        });
      });
    }
  });

  plugin.registerDomEvent(document, 'click', (evt: MouseEvent) => {
    const target = evt.target as HTMLElement | null;
    if (!target) return;
    
    const deepenBtn = target.closest('a.nova-deepen, button.nova-deepen');
    const moodBtn = target.closest('button.nova-mood-analyze');

    if (deepenBtn) {
      evt.preventDefault();
      const scope = deepenBtn.getAttribute('data-scope') ?? '';
      const label = deepenBtn.textContent ?? getLabel();
      const lineAttr = deepenBtn.getAttribute('data-line');
      const parsed = lineAttr !== null ? Number(lineAttr) : undefined;
      const hasValidLine = typeof parsed === 'number' && Number.isFinite(parsed);
      if (scope === 'note' || !hasValidLine) deepenNote(label).catch(() => {});
      else deepenLine(parsed as number).catch(() => {});
    } else if (moodBtn && analyzeMood) {
      evt.preventDefault();
      analyzeMood().catch(() => {});
    }
  });
}

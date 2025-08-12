import type { Plugin } from 'obsidian';

export function registerDeepenHandlers(
  plugin: Plugin,
  getLabel: () => string,
  deepenLine: (line: number) => Promise<void>,
  deepenNote: (label: string) => Promise<void>
) {
  plugin.registerMarkdownPostProcessor((el) => {
    el.querySelectorAll('a.nova-deepen').forEach((btn) => {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const elBtn = btn as HTMLAnchorElement;
        const lineAttr = elBtn.getAttribute('data-line');
        const scope = elBtn.getAttribute('data-scope') || '';
        const label = elBtn.textContent || getLabel();
        const parsed = lineAttr !== null ? Number(lineAttr) : undefined;
        const hasValidLine = typeof parsed === 'number' && Number.isFinite(parsed);
        if (scope === 'note' || !hasValidLine) deepenNote(label).catch(console.error);
        else deepenLine(parsed as number).catch(console.error);
      });
    });
  });

  plugin.registerDomEvent(document, 'click', (evt: MouseEvent) => {
    const t = evt.target as HTMLElement;
    const a = t.closest('a.nova-deepen') as HTMLAnchorElement | null;
    if (!a) return;
    evt.preventDefault();
    const scope = a.getAttribute('data-scope') || '';
    const label = a.textContent || getLabel();
    const lineAttr = a.getAttribute('data-line');
    const id = a.getAttribute('data-id') || '';
    const parsed = lineAttr !== null ? Number(lineAttr) : undefined;
    const hasValidLine = typeof parsed === 'number' && Number.isFinite(parsed);
    if (scope === 'note' || !hasValidLine) deepenNote(label).catch(console.error);
    else deepenLine(parsed as number).catch(console.error);
  });
}



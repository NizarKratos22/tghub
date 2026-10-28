/**
 * Copies text, falling back to a hidden text area where the Clipboard API is
 * missing or refused (in-app browsers, older Safari). True when it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The fallback borrows focus and the selection; both go back afterwards so keyboard users keep their place.
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', ''); // no on-screen keyboard
    // In view (no scroll jump) and at 16px (iOS zooms into smaller fields).
    Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' });
    document.body.appendChild(area);
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length); // iOS selects nothing in a read-only field without it
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
      if (selection && range) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      previous?.focus({ preventScroll: true });
    }
  }
}

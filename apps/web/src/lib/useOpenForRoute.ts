import { usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * Open/closed state for a menu, drawer or dialog that closes when the page changes.
 * The reset happens during render (React's "adjust state when a prop changes"
 * pattern), so the next page never paints a frame with the old menu still open.
 */
export function useOpenForRoute() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState(pathname);
  if (route !== pathname) {
    setRoute(pathname);
    setOpen(false);
  }
  return [open, setOpen] as const;
}

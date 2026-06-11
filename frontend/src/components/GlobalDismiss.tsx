'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function GlobalDismiss() {
  useEffect(() => {
    const handleClick = () => toast.dismiss();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);
  return null;
}

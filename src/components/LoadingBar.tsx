'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingBar() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-0.5 z-[100] shadow-[0_0_10px_rgba(0,255,240,0.5)]"
          style={{
            background: 'linear-gradient(90deg, #00fff0 0%, #a855f7 50%, #3b82f6 100%)',
          }}
          initial={{ scaleX: 0, transformOrigin: 'left' }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 1, transformOrigin: 'right', opacity: 0 }}
          transition={{
            scaleX: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.2, delay: 0.4 }
          }}
        />
      )}
    </AnimatePresence>
  );
}

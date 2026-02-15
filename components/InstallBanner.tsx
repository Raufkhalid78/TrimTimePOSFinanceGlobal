
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InstallBannerProps {
  deferredPrompt: any;
  onClose: () => void;
}

const InstallBanner: React.FC<InstallBannerProps> = ({ deferredPrompt, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches 
                         || (window.navigator as any).standalone 
                         || document.referrer.includes('android-app://');

    setIsStandalone(checkStandalone);

    if (checkStandalone) return;

    // 2. Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // 3. Show/Hide Logic
    // Show after 2 seconds to ensure page is loaded
    const showTimer = setTimeout(() => setIsVisible(true), 2000);
    
    // Hide after 6 seconds of visibility (2s delay + 6s display = 8s total)
    const hideTimer = setTimeout(() => setIsVisible(false), 8000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      onClose();
    }
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-96 z-[9999]"
        >
          <div className="bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 p-5 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-4 relative overflow-hidden">
            {/* Close Button */}
            <button 
                onClick={() => setIsVisible(false)} 
                className="absolute top-2 right-2 p-1.5 bg-white/10 dark:bg-black/10 rounded-full hover:bg-white/20 transition-colors"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            {/* App Icon */}
            <div className="w-12 h-12 bg-amber-500 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-950 dark:text-amber-500 font-brand text-2xl font-black shrink-0 shadow-lg">
              T
            </div>
            
            <div className="flex-1 min-w-0 pr-6">
              <h4 className="font-black text-sm tracking-tight mb-0.5">Install TrimTime</h4>
              <p className="text-[11px] opacity-90 font-medium leading-tight">
                {isIOS 
                  ? 'Tap Share then "Add to Home Screen"' 
                  : deferredPrompt
                    ? 'Install for a better experience'
                    : 'Tap menu (⋮) then "Install App"'
                }
              </p>
            </div>

            {/* Android Install Button */}
            {!isIOS && deferredPrompt && (
                <button 
                  onClick={handleInstall}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-transform shrink-0"
                >
                  Install
                </button>
            )}

            {/* iOS Indicator Arrow */}
            {isIOS && (
               <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-white dark:text-slate-900 animate-bounce">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
               </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallBanner;

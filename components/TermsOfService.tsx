
import React from 'react';
import { motion } from 'framer-motion';

interface TermsOfServiceProps {
  onClose: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} 
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-brand">Terms of Service</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          <p className="opacity-60 text-xs uppercase tracking-widest font-black">Last updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">1. Acceptance of Terms</h3>
            <p>By accessing and using TrimTime POS ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. Use of the service constitutes your acceptance of these terms.</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">2. Description of Service</h3>
            <p>TrimTime POS provides point-of-sale, inventory management, and financial reporting tools for barber shops and grooming businesses. We reserve the right to modify, suspend, or discontinue the Service at any time without notice.</p>
          </section>

          <section>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">3. User Accounts</h3>
             <p>You are responsible for maintaining the security of your account and password. TrimTime POS cannot and will not be liable for any loss or damage from your failure to comply with this security obligation. You are responsible for all content posted and activity that occurs under your account.</p>
          </section>

          <section>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">4. Subscription & Payments</h3>
             <p>The Service is billed in advance on a monthly or yearly basis. There are no refunds or credits for partial months of service, upgrade/downgrade refunds, or refunds for months unused with an open account.</p>
          </section>

          <section>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">5. Data Ownership</h3>
             <p>You own all content and data you upload to the Service. We claim no intellectual property rights over the material you provide to the Service. However, by setting your pages to be shared publicly, you agree to allow others to view your Content.</p>
          </section>

          <section>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">6. Limitation of Liability</h3>
             <p>In no event shall TrimTime POS, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>
          </section>
        </div>
        
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-center">
            <button onClick={onClose} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-opacity shadow-lg">
                I Understand
            </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TermsOfService;

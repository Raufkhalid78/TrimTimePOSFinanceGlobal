
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { Staff } from '../types';
import TermsOfService from './TermsOfService';

interface PaywallProps {
  currentUser: Staff;
  onSuccess: () => void;
  shopName: string;
}

const FEATURES = [
  "Unlimited Sales & Transactions",
  "Advanced AI Business Insights",
  "Multi-Staff Management",
  "Cloud Inventory Sync",
  "WhatsApp Digital Receipts",
  "Priority Support"
];

const PACKAGES = [
  {
    id: 'monthly',
    title: 'Monthly Pro',
    price: '20.00',
    period: 'mo',
    description: 'Full access billed monthly',
    isAnnual: false
  },
  {
    id: 'yearly',
    title: 'Yearly Pro',
    price: '200.00',
    period: 'yr',
    description: 'Full access billed yearly',
    isAnnual: true,
    savings: 'Save $40/year',
    crossPrice: '240.00'
  }
];

const Paywall: React.FC<PaywallProps> = ({ currentUser, onSuccess, shopName }) => {
  const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]); // Default to yearly
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setLoading(true);
    try {
      // 1. Get Shop ID
      const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', currentUser.id)
        .single();
        
      const shopId = shop?.id || currentUser.shopId || currentUser.shop_id;

      if (!shopId) throw new Error("Shop ID not found");

      // 2. Simulate Payment Processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 3. Update Subscription in Supabase
      const { error } = await supabase
        .from('shops')
        .update({ 
            subscription_status: 'active',
            subscription_plan: selectedPkg.id
        })
        .eq('id', shopId);

      if (error) throw error;

      onSuccess();
      
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Purchase failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
      setLoading(true);
      try {
          // Get Shop ID logic repeated
          const { data: shop } = await supabase.from('shops').select('id, subscription_status').eq('owner_id', currentUser.id).single();
          
          if (shop?.subscription_status === 'active') {
              alert("Subscription restored!");
              onSuccess();
          } else {
              alert("No active subscription found to restore.");
          }
      } catch (e) {
          console.error(e);
          alert("Restore failed.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-amber-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[100px] rounded-full"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10"
      >
        {/* Left Side: Copy */}
        <div className="text-center lg:text-left space-y-6">
          <div className="inline-block">
             <span className="bg-amber-500/20 text-amber-500 border border-amber-500/30 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
               Unlock Full Access
             </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Supercharge <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              {shopName || 'Your Shop'}
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md mx-auto lg:mx-0 leading-relaxed">
            Upgrade to <strong>TrimTime Pro</strong> to remove limits, enable AI insights, and manage unlimited staff members.
          </p>
          
          <ul className="space-y-3 max-w-sm mx-auto lg:mx-0">
            {FEATURES.map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-300 font-medium">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-sm">✓</div>
                {feat}
              </li>
            ))}
          </ul>
          
          <div className="pt-4 hidden lg:block">
             <button onClick={() => supabase.auth.signOut()} className="text-slate-500 hover:text-white text-sm font-bold transition-colors">
                Sign out & return later
             </button>
          </div>
        </div>

        {/* Right Side: Packages */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PACKAGES.map((pkg) => {
                const isSelected = selectedPkg?.id === pkg.id;
                
                return (
                  <div 
                    key={pkg.id}
                    onClick={() => setSelectedPkg(pkg)}
                    className={`relative cursor-pointer p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col justify-between h-52 ${isSelected ? 'bg-amber-500 border-amber-500 shadow-xl shadow-amber-500/20 transform scale-[1.02]' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}
                  >
                     {pkg.isAnnual && (
                       <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-slate-800 whitespace-nowrap">
                         {pkg.savings}
                       </div>
                     )}
                     
                     <div className="space-y-1">
                        <p className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-slate-900/60' : 'text-slate-500'}`}>
                            {pkg.isAnnual ? 'Best Value' : 'Flexible'}
                        </p>
                        <h3 className={`text-xl font-bold ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                            {pkg.title}
                        </h3>
                     </div>
                     
                     <div>
                        <div className="flex flex-col">
                           <div className="flex items-baseline gap-1">
                               <span className={`text-3xl font-black ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                                   ${pkg.price.split('.')[0]}
                               </span>
                               <span className={`text-sm font-bold ${isSelected ? 'text-slate-900/70' : 'text-slate-500'}`}>
                                   /{pkg.period}
                               </span>
                           </div>
                           {pkg.isAnnual && (
                               <span className={`text-xs font-bold line-through decoration-rose-500 decoration-2 ${isSelected ? 'text-slate-900/50' : 'text-slate-600'}`}>
                                   ${pkg.crossPrice}
                               </span>
                           )}
                        </div>
                        <p className={`text-[10px] mt-2 font-medium ${isSelected ? 'text-slate-900/70' : 'text-slate-500'}`}>
                           {pkg.description}
                        </p>
                     </div>
                  </div>
                );
              })}
           </div>

           <div className="space-y-4">
              <button 
                onClick={handlePurchase}
                disabled={loading || !selectedPkg}
                className="w-full bg-white text-slate-950 py-4 rounded-2xl font-black text-lg uppercase tracking-wide hover:bg-slate-200 transition-colors shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {loading ? (
                   <span className="flex items-center justify-center gap-2">
                     <svg className="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Processing...
                   </span>
                ) : (
                   `Start ${selectedPkg?.title || 'Plan'}`
                )}
              </button>
              
              <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                 <button onClick={handleRestore} className="hover:text-slate-300">Restore Purchases</button>
                 <span>•</span>
                 <button onClick={() => setShowTerms(true)} className="hover:text-slate-300">Terms of Service</button>
              </div>
           </div>
        </div>

        <div className="lg:hidden text-center pb-8">
             <button onClick={() => supabase.auth.signOut()} className="text-slate-500 hover:text-white text-sm font-bold transition-colors">
                Sign out & return later
             </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showTerms && <TermsOfService onClose={() => setShowTerms(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Paywall;

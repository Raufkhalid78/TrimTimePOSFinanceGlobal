
import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface PricingPageProps {
  onBack: () => void;
  onStartTrial: () => void;
}

const PRICING_TIERS = {
  monthly: {
    price: '20',
    period: 'mo',
    label: 'Monthly',
    desc: 'Perfect for new shops starting out.'
  },
  yearly: {
    price: '200',
    period: 'yr',
    label: 'Yearly',
    desc: 'Best value for established businesses.',
    savings: 'Save $40 per year'
  }
};

const FEATURES = [
  "Unlimited Transactions & Sales",
  "Advanced AI Business Insights",
  "Cloud Inventory Management",
  "Multi-Staff Scheduling (Up to 5)",
  "WhatsApp Digital Receipts",
  "Customer CRM & History",
  "Expense Tracking & Reports",
  "Priority 24/7 Support"
];

const PricingPage: React.FC<PricingPageProps> = ({ onBack, onStartTrial }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-slate-950 text-white overflow-y-auto pb-20 relative"
    >
      {/* Navigation */}
      <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto relative z-20">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
           <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center font-brand text-2xl text-slate-950 font-black">T</div>
           <span className="font-brand text-xl font-bold">TrimTime</span>
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-white font-bold text-sm transition-colors">
          Log In
        </button>
      </nav>

      {/* Hero Section */}
      <div className="text-center px-6 pt-10 pb-16 relative z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-amber-500/10 blur-[100px] rounded-full -z-10"></div>
        
        <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
          Simple Pricing for <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Modern Barber Shops</span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Manage your appointments, sales, and staff with the all-in-one POS system designed for growth. Start with a free trial today.
        </p>

        {/* Toggle */}
        <div className="flex justify-center items-center gap-4 mb-16">
          <span className={`text-sm font-bold transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
          <button 
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-16 h-8 bg-slate-800 rounded-full relative px-1 transition-colors hover:bg-slate-700"
          >
            <motion.div 
              layout
              className="w-6 h-6 bg-amber-500 rounded-full shadow-lg"
              animate={{ x: billingCycle === 'yearly' ? 32 : 0 }}
            />
          </button>
          <span className={`text-sm font-bold transition-colors ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
            Yearly <span className="text-amber-500 text-[10px] uppercase tracking-wider ml-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Save 17%</span>
          </span>
        </div>

        {/* Pricing Card */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-amber-500/30 transition-colors duration-500">
           <div className="md:col-span-3 p-8 md:p-12 text-left space-y-8 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/50 backdrop-blur-sm">
              <div>
                 <h3 className="text-2xl font-black text-white mb-2">TrimTime Pro</h3>
                 <p className="text-slate-400">Everything you need to run your shop smoothly.</p>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {FEATURES.map((feat, i) => (
                   <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                     <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">✓</div>
                     {feat}
                   </li>
                 ))}
              </ul>
           </div>
           
           <div className="md:col-span-2 p-8 md:p-12 flex flex-col justify-center items-center text-center bg-gradient-to-b from-slate-800/30 to-slate-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors duration-500"></div>
              
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-4">{PRICING_TIERS[billingCycle].period === 'yr' ? 'Billed Annually' : 'Billed Monthly'}</p>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                 <span className="text-5xl font-black text-white">${PRICING_TIERS[billingCycle].price}</span>
                 <span className="text-slate-500 font-bold">/{PRICING_TIERS[billingCycle].period}</span>
              </div>
              {billingCycle === 'yearly' && (
                 <p className="text-emerald-400 text-xs font-bold mb-8">{PRICING_TIERS[billingCycle].savings}</p>
              )}
              
              <button 
                onClick={onStartTrial}
                className="w-full bg-white text-slate-950 py-4 rounded-xl font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-xl shadow-white/10 active:scale-95"
              >
                Start Free Trial
              </button>
              <p className="text-slate-500 text-[10px] mt-4 font-medium">No credit card required for signup</p>
           </div>
        </div>
      </div>

      {/* FAQ / Trust */}
      <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
         <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800">
            <h4 className="font-bold text-white mb-2">Secure Cloud</h4>
            <p className="text-sm text-slate-400">Your data is encrypted and backed up daily. Never lose a transaction.</p>
         </div>
         <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800">
            <h4 className="font-bold text-white mb-2">Works Offline</h4>
            <p className="text-sm text-slate-400">Internet down? Keep making sales. Data syncs when you reconnect.</p>
         </div>
         <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800">
            <h4 className="font-bold text-white mb-2">Device Friendly</h4>
            <p className="text-sm text-slate-400">Works on iPad, Android tablets, Mac, and PC. No special hardware needed.</p>
         </div>
      </div>
    </motion.div>
  );
};

export default PricingPage;

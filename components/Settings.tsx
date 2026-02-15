
import React, { useState, useEffect } from 'react';
import { ShopSettings, Language, Staff, DiscountCode } from '../types';
import { CURRENCY_OPTIONS, TRANSLATIONS, COUNTRY_CODES } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsProps {
  settings: ShopSettings;
  onUpdateSettings: (settings: ShopSettings) => void;
  currentUser?: Staff;
  onPurgeSales?: () => void;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, currentUser, onPurgeSales, onLogout }) => {
  const [formData, setFormData] = useState<ShopSettings>(settings);
  const [isCustomCurrency, setIsCustomCurrency] = useState(!CURRENCY_OPTIONS.some(opt => opt.symbol === settings.currency));
  const [newPromo, setNewPromo] = useState<DiscountCode>({ code: '', type: 'percentage', value: 0, description: '' });
  
  const t = TRANSLATIONS[settings.language];

  // Sync formData with settings prop when it changes (e.g. after initial DB load)
  useEffect(() => {
    setFormData(settings);
    setIsCustomCurrency(!CURRENCY_OPTIONS.some(opt => opt.symbol === settings.currency));
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    alert('Configuration updated successfully!');
  };

  const handleCurrencyChange = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomCurrency(true);
    } else {
      setIsCustomCurrency(false);
      setFormData({ ...formData, currency: val });
    }
  };

  const handleResetSales = () => {
    if (confirm(t.confirmReset)) {
        if (onPurgeSales) onPurgeSales();
    }
  };

  const addPromoCode = () => {
    if (!newPromo.code || newPromo.value <= 0) return;
    
    // Create the updated list
    const updatedCodes = [...(formData.promoCodes || []), { ...newPromo, code: newPromo.code.toUpperCase() }];
    const updatedSettings = { ...formData, promoCodes: updatedCodes };
    
    // Update local state immediately for UI responsiveness
    setFormData(updatedSettings);
    
    // Save to database immediately
    onUpdateSettings(updatedSettings);
    
    // Reset input fields
    setNewPromo({ code: '', type: 'percentage', value: 0, description: '' });
  };

  const removePromoCode = (codeToRemove: string) => {
    // Create the updated list
    const updatedCodes = (formData.promoCodes || []).filter(c => c.code !== codeToRemove);
    const updatedSettings = { ...formData, promoCodes: updatedCodes };
    
    // Update local state immediately
    setFormData(updatedSettings);
    
    // Save to database immediately
    onUpdateSettings(updatedSettings);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-12">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white font-brand">{t.settings}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t.fineTune}</p>
      </div>

      {currentUser?.role === 'admin' ? (
      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">{t.shopBranding}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.terminalIdentity}</label>
              <input 
                type="text" 
                value={formData.shopName}
                onChange={e => setFormData({...formData, shopName: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" 
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.language} / زبان / भाषा</label>
              <select 
                value={formData.language}
                onChange={e => setFormData({...formData, language: e.target.value as Language})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200"
              >
                <option value="en">English (US)</option>
                <option value="ur">Urdu (اردو)</option>
                <option value="fa">Persian (فارسی)</option>
                <option value="hi">Hindi (हिंदी)</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">{t.preferredCurrency}</label>
              <select 
                value={isCustomCurrency ? 'CUSTOM' : formData.currency}
                onChange={e => handleCurrencyChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200"
              >
                {CURRENCY_OPTIONS.map(opt => (
                  <option key={opt.symbol} value={opt.symbol}>{opt.label}</option>
                ))}
                <option value="CUSTOM">{t.customSymbol}</option>
              </select>
              
              <AnimatePresence>
                {isCustomCurrency && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <input 
                      type="text" 
                      placeholder="Symbol (e.g. Rs.)"
                      value={formData.currency}
                      onChange={e => setFormData({...formData, currency: e.target.value})}
                      className="w-full bg-slate-100 dark:bg-slate-800/50 border-0 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.defaultCountryCode}</label>
                <select 
                    value={formData.defaultCountryCode || '+1'}
                    onChange={e => setFormData({...formData, defaultCountryCode: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200"
                >
                    {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.country} ({c.code})</option>
                    ))}
                </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.taxCalculation}</label>
              <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-100 dark:border-slate-700">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, taxType: 'excluded'})}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${formData.taxType === 'excluded' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  {t.excluded}
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, taxType: 'included'})}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${formData.taxType === 'included' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  {t.included}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.taxRate}</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.taxRate}
                  onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value) || 0})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none pr-12 text-sm font-bold dark:text-slate-200" 
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 font-black">%</span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.receiptFooter}</label>
              <textarea 
                value={formData.receiptFooter}
                onChange={e => setFormData({...formData, receiptFooter: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none h-[52px] resize-none text-sm font-medium dark:text-slate-300 overflow-hidden" 
              />
            </div>
          </div>
        </motion.div>

        {/* Promo Codes Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">{t.promoCodes}</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form to Add New */}
            <div className="lg:col-span-1 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
               <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{t.addPromo}</h4>
               <div>
                  <input 
                    type="text" 
                    placeholder={t.code}
                    value={newPromo.code}
                    onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-black uppercase dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
               </div>
               <div className="grid grid-cols-2 gap-3">
                   <select 
                      value={newPromo.type}
                      onChange={e => setNewPromo({...newPromo, type: e.target.value as 'percentage' | 'fixed'})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs font-bold dark:text-white focus:outline-none"
                   >
                      <option value="percentage">{t.percentage}</option>
                      <option value="fixed">{t.fixed}</option>
                   </select>
                   <input 
                    type="number" 
                    placeholder={t.value}
                    value={newPromo.value || ''}
                    onChange={e => setNewPromo({...newPromo, value: parseFloat(e.target.value) || 0})}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs font-bold dark:text-white focus:outline-none"
                  />
               </div>
               <div>
                  <input 
                    type="text" 
                    placeholder={t.description}
                    value={newPromo.description}
                    onChange={e => setNewPromo({...newPromo, description: e.target.value})}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium dark:text-white focus:outline-none"
                  />
               </div>
               <button 
                 type="button"
                 onClick={addPromoCode}
                 className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
               >
                 Add Code (Auto-Save)
               </button>
            </div>

            {/* List of Existing */}
            <div className="lg:col-span-2 space-y-3 max-h-80 overflow-y-auto scrollbar-hide">
               {(formData.promoCodes || []).length === 0 ? (
                 <p className="text-slate-400 text-sm italic text-center py-8">No active promo codes.</p>
               ) : (
                 (formData.promoCodes || []).map((code, idx) => (
                   <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border border-purple-100 dark:border-purple-900/30">
                            {code.code}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                               {code.type === 'percentage' ? `${code.value}% OFF` : `-${settings.currency}${code.value} OFF`}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{code.description}</p>
                         </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removePromoCode(code.code)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                   </div>
                 ))
               )}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-500">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.224-3.52c1.54.914 3.453 1.403 5.385 1.404h.005c5.632 0 10.211-4.579 10.214-10.211 0-2.729-1.063-5.295-2.993-7.225s-4.496-2.992-7.225-2.993c-5.633 0-10.213 4.58-10.214 10.214 0 2.022.529 3.996 1.531 5.74l-.991 3.618 3.707-.972zm11.233-5.62c-.301-.151-1.782-.879-2.057-.979-.275-.1-.475-.151-.675.151s-.777.979-.952 1.179-.35.225-.65.076c-.301-.151-1.268-.467-2.417-1.492-.892-.795-1.494-1.777-1.669-2.078-.175-.301-.019-.463.131-.613.135-.134.301-.351.451-.526s.201-.3.301-.5c.101-.201.05-.376-.025-.526s-.675-1.629-.925-2.229c-.244-.583-.491-.504-.675-.513-.175-.008-.376-.01-.576-.01s-.526.076-.801.376c-.275.301-1.051 1.028-1.051 2.508s1.076 2.908 1.226 3.109c.151.201 2.118 3.235 5.132 4.537.717.309 1.277.494 1.714.633.72.228 1.375.196 1.892.119.577-.085 1.782-.728 2.032-1.429s.25-.151.25-.376-.101-.351-.401-.502z"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t.whatsAppSummaries}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.enableWhatsApp}</p>
              </div>
            </div>
            <div className="flex items-center">
              <input 
                type="checkbox" 
                checked={formData.whatsappEnabled}
                onChange={e => setFormData({...formData, whatsappEnabled: e.target.checked})}
                className="w-6 h-6 rounded-lg text-amber-500 focus:ring-amber-500 border-slate-300 dark:border-slate-700 bg-transparent"
              />
            </div>
          </div>

          <div className={`space-y-4 transition-all duration-300 ${formData.whatsappEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.businessMobile}</label>
              <input 
                type="tel" 
                placeholder="+1234567890"
                value={formData.whatsappNumber}
                onChange={e => setFormData({...formData, whatsappNumber: e.target.value})}
                className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" 
              />
            </div>
          </div>
        </motion.div>

        {/* Automatic Sales Reset Cycle */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
        >
           <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div>
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">Monthly Sales Cycle</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure when your business month starts.</p>
                </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">{t.billingCycle}</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="1"
                      max="28"
                      value={formData.billingCycleDay || 1}
                      onChange={e => setFormData({...formData, billingCycleDay: Math.min(28, Math.max(1, parseInt(e.target.value) || 1))})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none pr-12 text-sm font-bold dark:text-slate-200" 
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase">{t.billingDay}</span>
                  </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 font-medium leading-relaxed">
                    <strong>Auto-Reset Enabled:</strong> On day {formData.billingCycleDay} of every month, your dashboard and reports will automatically refresh to show the new period's data. Previous sales are safely stored in history.
                  </p>
              </div>
           </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-rose-50/50 dark:bg-rose-900/10 p-6 md:p-8 rounded-[2rem] border border-rose-100 dark:border-rose-900/30 shadow-sm space-y-6"
        >
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/40 rounded-xl flex items-center justify-center text-rose-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                  <h3 className="text-lg md:text-xl font-bold text-rose-600 dark:text-rose-400">{t.dangerZone}</h3>
                  <p className="text-xs text-rose-400 dark:text-rose-500/70 mt-1">{t.resetSalesDesc}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button 
                  type="button"
                  onClick={handleResetSales}
                  className="bg-rose-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
              >
                  {t.resetSales}
              </button>
            </div>
        </motion.div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4 pt-4">
            <button 
                type="button" 
                onClick={() => {
                  setFormData(settings);
                  setIsCustomCurrency(!CURRENCY_OPTIONS.some(opt => opt.symbol === settings.currency));
                }}
                className="px-8 py-4 font-black text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-colors uppercase text-xs tracking-widest"
            >
                {t.resetChanges}
            </button>
            <button 
                type="submit" 
                className="bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950 px-10 py-4 rounded-2xl font-black text-base hover:bg-slate-800 dark:hover:bg-amber-600 transition-all shadow-xl active:scale-95"
            >
                {t.saveSettings}
            </button>
        </div>
      </form>
      ) : (
        <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-2xl text-center border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 font-medium text-sm">Global shop settings are managed by administrators.</p>
        </div>
      )}

      {/* Account Section - Visible to All */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-500 uppercase text-xl shadow-inner">
                  {currentUser?.name.charAt(0)}
              </div>
              <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">{currentUser?.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{currentUser?.role}</p>
              </div>
          </div>
          <button 
              onClick={onLogout}
              className="w-full md:w-auto px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 transition-all border border-transparent hover:border-rose-200 dark:hover:border-rose-900/30"
          >
              {t.logout}
          </button>
      </motion.div>
    </div>
  );
};

export default Settings;

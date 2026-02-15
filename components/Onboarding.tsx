
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { ShopSettings, Staff, Language, UserRole } from '../types';
import { CURRENCY_OPTIONS, DEFAULT_SETTINGS, COUNTRY_CODES } from '../constants';
import { supabase } from '../supabaseClient';

interface OnboardingProps {
  currentUser: Staff;
  onComplete: () => void;
  initialSettings: ShopSettings;
}

const Onboarding: React.FC<OnboardingProps> = ({ currentUser, onComplete, initialSettings }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 2: Shop Details
  const [settings, setSettings] = useState<ShopSettings>(initialSettings);
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);

  // Step 3: Staff
  const [staffList, setStaffList] = useState<Partial<Staff>[]>([
      // Admin is already there, these are NEW staff members
  ]);
  const [newStaff, setNewStaff] = useState<{name: string, username: string, password: string, role: UserRole}>({ name: '', username: '', password: '', role: 'employee' });

  const totalStaffCount = 1 + staffList.length; // 1 Admin + added staff

  // PDF Generation for Manual
  const downloadManual = () => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("TrimTime POS - User Manual", 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.text("Quick Start Guide", 20, 40);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    const lines = [
        "1. Dashboard: View real-time sales, expenses, and insights.",
        "2. POS Terminal: Process transactions using Cash, Card, or Wallet.",
        "3. Catalog: Manage your services and products (Inventory).",
        "4. Staff: Manage team access and view commission reports.",
        "5. Customers: Track client history and preferences.",
        "6. Finance: Record expenses and generate AI insights.",
        "",
        "For support, contact your system administrator."
    ];
    
    let y = 50;
    lines.forEach(line => {
        doc.text(line, 20, y);
        y += 10;
    });
    
    doc.save("TrimTime_Manual.pdf");
  };

  // Step 2 Logic
  const handleCurrencyChange = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomCurrency(true);
      setSettings({...settings, currency: ''});
    } else {
      setIsCustomCurrency(false);
      setSettings({ ...settings, currency: val });
    }
  };

  // Step 3 Logic
  const addStaffMember = () => {
      if (!newStaff.name || !newStaff.username || !newStaff.password) return;
      if (totalStaffCount >= 5) {
          alert("Maximum 5 staff members allowed.");
          return;
      }
      setStaffList([...staffList, { ...newStaff, id: Math.random().toString(36).substr(2, 9), commission: 30 }]);
      setNewStaff({ name: '', username: '', password: '', role: 'employee' });
  };

  const removeStaffMember = (idx: number) => {
      const newList = [...staffList];
      newList.splice(idx, 1);
      setStaffList(newList);
  };

  // Final Submission
  const handleFinish = async () => {
      setLoading(true);
      try {
          const shopId = currentUser.shopId || currentUser.shop_id;
          if (!shopId) throw new Error("Shop ID missing");

          // 1. Update Shop Settings (Name, Location, Language, Currency)
          await supabase.from('settings').upsert({
              shop_id: shopId,
              data: settings
          });

          // 2. Add New Staff
          if (staffList.length > 0) {
              const staffRows = staffList.map(s => ({
                  id: 'st_' + Math.random().toString(36).substr(2, 9),
                  shop_id: shopId,
                  name: s.name,
                  role: s.role,
                  commission: s.commission || 30,
                  username: s.username,
                  password: s.password,
                  email: ''
              }));
              const { error: staffError } = await supabase.from('staff').insert(staffRows);
              if (staffError) throw staffError;
          }

          // 3. Mark Onboarding as Complete
          const { error: shopError } = await supabase.from('shops').update({ onboarding_completed: true }).eq('id', shopId);
          if (shopError) throw shopError;

          onComplete();

      } catch (err) {
          console.error("Onboarding Error:", err);
          alert("Failed to save setup. Please try again.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[9999] flex items-center justify-center p-4">
        {/* Background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>

        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden relative"
        >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800">
                <motion.div 
                    className="h-full bg-amber-500" 
                    initial={{ width: '33%' }}
                    animate={{ width: `${(step / 3) * 100}%` }}
                />
            </div>

            <div className="p-8 md:p-12">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-8 text-center">
                            <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center font-brand text-4xl text-slate-950 mx-auto shadow-lg shadow-amber-500/20">T</div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black text-white mb-4">Welcome to TrimTime</h1>
                                <p className="text-slate-400 text-lg leading-relaxed">
                                    Let's get your shop set up for success. We've prepared a quick guide to help you understand the features.
                                </p>
                            </div>
                            
                            <div className="flex flex-col gap-4 max-w-xs mx-auto">
                                <button onClick={downloadManual} className="bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-700">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    Download User Manual
                                </button>
                                <button onClick={() => setStep(2)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-amber-500/10">
                                    Start Setup →
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black text-white">Shop Details</h2>
                                <p className="text-slate-400 text-sm">Tell us about your business.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Shop Name</label>
                                    <input value={settings.shopName} onChange={e => setSettings({...settings, shopName: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 outline-none" placeholder="My Barber Shop" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Location</label>
                                    <input value={settings.location || ''} onChange={e => setSettings({...settings, location: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 outline-none" placeholder="City, Country" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Currency</label>
                                    <select 
                                        value={isCustomCurrency ? 'CUSTOM' : settings.currency}
                                        onChange={e => handleCurrencyChange(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    >
                                        {CURRENCY_OPTIONS.map(opt => (
                                        <option key={opt.symbol} value={opt.symbol}>{opt.label}</option>
                                        ))}
                                        <option value="CUSTOM">Custom Symbol</option>
                                    </select>
                                    {isCustomCurrency && (
                                        <input value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white mt-2 focus:ring-2 focus:ring-amber-500/50 outline-none" placeholder="Symbol (e.g. Rs.)" />
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Language</label>
                                    <select 
                                        value={settings.language}
                                        onChange={e => setSettings({...settings, language: e.target.value as any})}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    >
                                        <option value="en">English (US)</option>
                                        <option value="ur">Urdu (اردو)</option>
                                        <option value="fa">Persian (فارسی)</option>
                                        <option value="hi">Hindi (हिंदी)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Default Country Code</label>
                                    <select 
                                        value={settings.defaultCountryCode || '+1'}
                                        onChange={e => setSettings({...settings, defaultCountryCode: e.target.value})}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500/50 outline-none"
                                    >
                                        {COUNTRY_CODES.map(c => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.country} ({c.code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button onClick={() => setStep(3)} disabled={!settings.shopName || !settings.currency} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-4 rounded-2xl font-black text-lg transition-all mt-4 disabled:opacity-50">
                                Next Step →
                            </button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-black text-white">Team Setup</h2>
                                <p className="text-slate-400 text-sm">Create accounts for your staff (Max 5).</p>
                            </div>

                            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Team Members ({totalStaffCount}/5)</span>
                                </div>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700 opacity-60">
                                        <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-white">A</div>
                                        <div className="flex-1 text-white text-sm font-bold">{currentUser.name || 'Admin'} <span className="text-amber-500 text-xs ml-2">(You)</span></div>
                                    </div>
                                    {staffList.map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700">
                                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold text-white">{s.name?.charAt(0)}</div>
                                            <div className="flex-1">
                                                <p className="text-white text-sm font-bold">{s.name}</p>
                                                <p className="text-slate-500 text-[10px]">@{s.username}</p>
                                            </div>
                                            <button onClick={() => removeStaffMember(idx)} className="text-rose-500 hover:text-rose-400 p-1">✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {totalStaffCount < 5 && (
                                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-800/30 rounded-2xl border border-slate-800/50">
                                    <input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className="col-span-3 bg-slate-900 border-none rounded-lg px-3 py-2 text-sm text-white" />
                                    <input placeholder="Username" value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})} className="bg-slate-900 border-none rounded-lg px-3 py-2 text-sm text-white" />
                                    <input placeholder="Password" type="text" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} className="bg-slate-900 border-none rounded-lg px-3 py-2 text-sm text-white" />
                                    <button onClick={addStaffMember} className="bg-white text-slate-900 font-bold rounded-lg text-xs uppercase hover:bg-slate-200">Add</button>
                                </div>
                            )}

                            <button onClick={handleFinish} disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50">
                                {loading ? 'Finalizing...' : 'Complete Setup'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    </div>
  );
};

export default Onboarding;

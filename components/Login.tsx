
import React, { useState } from 'react';
import { Staff, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import TermsOfService from './TermsOfService';

interface LoginProps {
  onLogin: (user: Staff, rememberMe: boolean) => void;
  staffList: Staff[]; // Kept for prop compatibility, but ignored for auth
  shopName: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, shopName }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  // Default to English for login screen
  const language: Language = 'en'; 
  const t = TRANSLATIONS[language];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let authResult;
      
      if (isSignUp) {
        authResult = await supabase.auth.signUp({
          email,
          password,
        });

        if (authResult.error) throw authResult.error;

        // Check if email verification is required (session is null if email confirmation is on)
        // If user is created but no session, verification is required
        if (authResult.data.user && !authResult.data.session) {
            setVerificationSent(true);
            setLoading(false);
            return;
        }
      } else {
        authResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authResult.error) throw authResult.error;
      }

      if (!authResult.data.user) throw new Error('No user data returned');
      const userId = authResult.data.user.id;

      // Auth successful. Now we need the Staff profile.
      // Poll for staff profile (handles DB trigger latency on signup)
      // Retry up to 5 times to ensure we catch the trigger creation
      const maxRetries = 5;
      let staffData = null;
      let retryCount = 0;

      while (!staffData && retryCount < maxRetries) {
          if (retryCount > 0) await new Promise(r => setTimeout(r, 1000));

          const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();

          if (!error && data) {
              staffData = data;
          }
          retryCount++;
      }
      
      // AUTO-REPAIR LOGIC
      // If trigger failed or data is missing, attempt to self-repair the account
      if (!staffData) {
         console.log("Account incomplete. Attempting repair...");
         
         // 1. Check/Create Shop
         let { data: shop } = await supabase.from('shops').select('id').eq('owner_id', userId).maybeSingle();
         
         if (!shop) {
             // Attempt to create shop
             const { data: newShop, error: shopError } = await supabase
                .from('shops')
                .insert([{ owner_id: userId, name: shopName || 'My Barber Shop' }])
                .select()
                .single();
             
             if (shopError) {
                 console.error("Repair failed (Shop):", shopError);
                 throw new Error("Unable to set up your shop data. Please contact support.");
             }
             shop = newShop;

             // Initialize defaults for new shop
             if (shop) {
                 await supabase.from('settings').insert({
                     shop_id: shop.id,
                     data: {
                        shopName: shopName || "TrimTime", 
                        currency: "$", 
                        language: "en", 
                        taxRate: 0, 
                        taxType: "excluded", 
                        whatsappEnabled: true,
                        billingCycleDay: 1,
                        promoCodes: []
                     }
                 });
                 
                 await supabase.from('services').insert([
                    { id: 'svc_' + Math.random().toString(36).substr(2,9), shop_id: shop.id, name: 'Classic Haircut', price: 30, duration: 30, category: 'Hair' },
                    { id: 'svc_' + Math.random().toString(36).substr(2,9), shop_id: shop.id, name: 'Beard Trim', price: 20, duration: 20, category: 'Beard' }
                 ]);
             }
         }
         
         // 2. Check/Create Admin Staff
         if (shop) {
             const { data: adminStaff } = await supabase
                .from('staff')
                .select('*')
                .eq('shop_id', shop.id)
                .eq('role', 'admin')
                .maybeSingle();
             
             if (adminStaff) {
                 staffData = adminStaff;
             } else {
                 const { data: newStaff, error: staffError } = await supabase
                    .from('staff')
                    .insert([{
                        id: 'st_' + Math.random().toString(36).substr(2,9),
                        shop_id: shop.id,
                        name: 'Owner',
                        role: 'admin',
                        commission: 0,
                        username: 'admin',
                        password: '1234'
                    }])
                    .select()
                    .single();
                    
                 if (staffError) {
                     console.error("Repair failed (Staff):", staffError);
                     throw new Error("Unable to create admin profile. Please contact support.");
                 }
                 staffData = newStaff;
             }
         }
      }

      if (!staffData) {
         throw new Error("Account setup incomplete. If you are an employee, ask your admin for credentials.");
      }

      // Success
      onLogin(staffData, rememberMe);

    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = err.message || "Authentication failed";
      
      // User-friendly error mapping
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes("invalid login credentials")) {
          msg = "Invalid email or password.";
      } else if (lowerMsg.includes("rate limit")) {
          msg = "Too many attempts. Please wait a few moments.";
      } else if (lowerMsg.includes("user already registered")) {
          msg = "This email is already registered. Please sign in.";
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            whileHover={{ rotate: 12, scale: 1.1 }}
            className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[2rem] flex items-center justify-center font-brand text-4xl text-slate-950 mx-auto mb-6 shadow-2xl shadow-amber-500/40"
          >
            {(shopName || 'T').charAt(0)}
          </motion.div>
          <h1 className="text-4xl font-extrabold font-brand text-white tracking-tighter mb-2">{shopName || 'TrimTime'}</h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">
             {isSignUp ? 'Create Your Shop Account' : t.premiumAccess}
          </p>
        </div>

        <motion.div 
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 md:p-10 rounded-[2.5rem] shadow-2xl"
        >
          {verificationSent ? (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-4"
            >
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-4xl mb-4 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                    ✉️
                </div>
                <div>
                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Check your email</h3>
                    <p className="text-slate-400 font-medium leading-relaxed">
                        We've sent a verification link to <br/>
                        <span className="text-emerald-400 font-bold">{email}</span>
                    </p>
                    <p className="text-slate-500 text-sm mt-4 font-medium">
                        Click the link in the email to verify your account and access your dashboard.
                    </p>
                </div>
                <button 
                    onClick={() => {
                        setVerificationSent(false);
                        setIsSignUp(false); // Switch to sign in view
                        setError('');
                    }}
                    className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700 mt-4 active:scale-95"
                >
                    Back to Sign In
                </button>
            </motion.div>
          ) : (
          <>
          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full bg-slate-800/30 border border-slate-700/50 text-white rounded-2xl px-6 py-4 focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                required
              />
            </div>

            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/30 border border-slate-700/50 text-white rounded-2xl px-6 py-4 pr-12 focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                  )}
                </button>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center gap-3 pl-2">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-700 bg-slate-800/50 checked:bg-amber-500 checked:border-amber-500 transition-all"
                  />
                  <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-950 opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <label htmlFor="rememberMe" className="text-xs font-bold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-200 transition-colors">
                  {t.stayLoggedIn}
                </label>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-black uppercase tracking-wider py-3 px-4 rounded-xl text-center"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xl py-4 rounded-2xl shadow-xl shadow-amber-500/10 transition-all hover:shadow-amber-500/30 mt-4 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                isSignUp ? "Create Account" : t.enterDashboard
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center space-y-4">
             <button 
               type="button"
               onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
               className="text-sm text-slate-400 font-bold hover:text-white transition-colors"
             >
               {isSignUp ? "Already have an account? Sign In" : "New to TrimTime? Create Account"}
             </button>

             <div className="flex items-center justify-between">
                <div className="h-px bg-slate-800 flex-1"></div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-4 whitespace-nowrap">{t.authorizedUse}</span>
                <div className="h-px bg-slate-800 flex-1"></div>
             </div>
             
             <div className="pt-2">
                 <button onClick={() => setShowTerms(true)} className="text-[10px] text-slate-500 hover:text-slate-400 font-bold uppercase tracking-widest transition-colors">
                    Terms of Service & Privacy
                 </button>
             </div>
          </div>
          </>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showTerms && <TermsOfService onClose={() => setShowTerms(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Login;

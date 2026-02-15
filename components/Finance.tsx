
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Sale, Expense, Staff, Language, Customer, ShopSettings } from '../types';
import { TRANSLATIONS } from '../constants';
import { getFinancialInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface FinanceProps {
  sales: Sale[];
  expenses: Expense[];
  staffList: Staff[];
  customers: Customer[];
  currency: string;
  language: Language;
  currentUser: Staff;
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onDeleteSales: (ids: string[]) => void;
  settings: ShopSettings;
}

const Finance: React.FC<FinanceProps> = ({ sales, expenses, staffList, customers, currency, language, currentUser, onAddExpense, onDeleteExpense, onDeleteSales, settings }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'expenses'>(currentUser.role === 'admin' ? 'overview' : 'expenses');
  const [newExp, setNewExp] = useState<{ category: string; amount: string; description: string; receiptImage: string | null }>({ 
    category: '', 
    amount: '', 
    description: '',
    receiptImage: null 
  });
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  
  // Hide tab bar on scroll logic
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const mainContainer = document.querySelector('main');
    if (!mainContainer) return;
    const handleScroll = () => {
      const currentScrollY = mainContainer.scrollTop;
      // Threshold to avoid flicker on small scrolls
      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        setIsTabBarVisible(false);
      } else {
        setIsTabBarVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    mainContainer.addEventListener('scroll', handleScroll);
    return () => mainContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TRANSLATIONS[language];

  const enrichedSales = useMemo(() => {
    return sales.map(sale => {
      const staffMember = staffList.find(s => s.id === sale.staffId);
      const customer = customers.find(c => c.id === sale.customerId);
      return {
        ...sale,
        staffName: sale.staffName || (staffMember ? staffMember.name : 'Unknown Staff'),
        customerName: sale.customerName || (customer ? customer.name : 'Walk-in Client')
      };
    });
  }, [sales, staffList, customers]);

  const totalRevenue = sales.reduce((a, b) => a + b.total, 0);
  const totalExpenses = expenses.reduce((a, b) => a + b.amount, 0);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedTransactions);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTransactions(newSet);
  };

  const toggleAll = () => {
    if (selectedTransactions.size === enrichedSales.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(enrichedSales.map(s => s.id)));
    }
  };

  const handleDeleteSelected = () => {
     if (selectedTransactions.size === 0) return;
     if (confirm(`⚠️ DELETE DATA\n\nAre you sure you want to delete ${selectedTransactions.size} transactions?\nThis action cannot be undone.`)) {
       onDeleteSales(Array.from(selectedTransactions));
       setSelectedTransactions(new Set());
     }
  };

  const handleGenerateAdvice = async () => {
    setGeneratingAdvice(true);
    try {
      const advice = await getFinancialInsights(sales, expenses);
      setAiAdvice(advice);
    } catch (e) {
      setAiAdvice("Insight generation failed.");
    } finally {
      setGeneratingAdvice(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;
        if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
        else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setNewExp(prev => ({ ...prev, receiptImage: canvas.toDataURL('image/jpeg', 0.7) }));
      };
      if (event.target?.result) img.src = event.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newExp.category || !newExp.amount) return;
      onAddExpense({
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString().split('T')[0],
          category: newExp.category,
          amount: parseFloat(newExp.amount),
          description: newExp.description,
          receiptImage: newExp.receiptImage || undefined
      });
      setNewExp({ category: '', amount: '', description: '', receiptImage: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderReceiptModal = () => {
    if (!viewingSale) return null;
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setViewingSale(null)}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="bg-white text-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                 <div className="bg-slate-900 text-white p-6 text-center">
                    <h2 className="font-brand text-2xl font-bold">{settings.shopName}</h2>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Transaction Receipt</p>
                 </div>
                 <div className="p-6 space-y-4">
                    <div className="flex justify-between text-xs border-b pb-4">
                        <div>
                            <p className="font-bold">{new Date(viewingSale.timestamp).toLocaleDateString(language)}</p>
                            <p className="opacity-50 font-mono">#{viewingSale.id.slice(0,8)}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">{viewingSale.staffName}</p>
                            <p className="opacity-50">{viewingSale.customerName}</p>
                        </div>
                    </div>
                    <div className="space-y-2 py-2 max-h-48 overflow-y-auto">
                        {viewingSale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span>{item.quantity}x {item.name}</span>
                                <span className="font-bold">{currency}{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t pt-4 space-y-1">
                        <div className="flex justify-between text-sm"><span>Total</span><span className="text-xl font-black">{currency}{viewingSale.total.toFixed(2)}</span></div>
                    </div>
                 </div>
            </motion.div>
        </motion.div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs font-bold shadow-xl border border-slate-700">
          <p className="mb-1 text-slate-400">{label}</p>
          <p className="capitalize">{payload[0].name}: {currency}{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <motion.div 
        animate={{ y: isTabBarVisible ? 0 : -80, opacity: isTabBarVisible ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar sticky top-0 z-40"
      >
        <div className="flex gap-1 min-w-max w-full">
           {currentUser.role === 'admin' && (
             <>
               <button onClick={() => setActiveTab('overview')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>Overview</button>
               <button onClick={() => setActiveTab('transactions')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>Transactions</button>
             </>
           )}
           <button onClick={() => setActiveTab('expenses')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'expenses' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>Expenses</button>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800">
               <h3 className="text-xl font-bold mb-8 flex items-center gap-3">📊 {t.shopPerformance}</h3>
               <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Summary', rev: totalRevenue, exp: totalExpenses }]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-5" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${currency}${val}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="rev" name="Revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="exp" name="Expenses" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800">
                  <h3 className="font-bold mb-4">{t.commissionReport}</h3>
                  <div className="space-y-3">
                     {staffList.filter(s => s.role === 'employee').map(s => {
                        const sRev = sales.filter(x => x.staffId === s.id).reduce((a,b) => a+b.total, 0);
                        return (
                          <div key={s.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                             <span className="text-sm font-bold">{s.name}</span>
                             <span className="font-black text-emerald-600">{currency}{((sRev * s.commission) / 100).toFixed(2)}</span>
                          </div>
                        );
                     })}
                  </div>
               </div>

               <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[2rem] text-white">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">✨ {t.smartInsights}</h3>
                  <p className="text-indigo-100 text-xs mb-6">{t.aiPrompt}</p>
                  {aiAdvice ? (
                      <div className="bg-white/10 p-4 rounded-xl text-sm max-h-48 overflow-y-auto"><ReactMarkdown>{aiAdvice}</ReactMarkdown></div>
                  ) : (
                      <button onClick={handleGenerateAdvice} disabled={generatingAdvice} className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-xs uppercase disabled:opacity-50">{generatingAdvice ? '...' : t.generateAdvice}</button>
                  )}
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div key="tr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 overflow-hidden">
             <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <input type="checkbox" onChange={toggleAll} checked={selectedTransactions.size === enrichedSales.length && enrichedSales.length > 0} className="w-5 h-5 rounded text-amber-500" />
                   <span className="text-xs font-bold">{selectedTransactions.size} Selected</span>
                </div>
                {selectedTransactions.size > 0 && <button onClick={handleDeleteSelected} className="text-rose-500 text-xs font-black uppercase">Delete Selected</button>}
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
                      <tr><th className="p-4 w-10"></th><th className="p-4">Time</th><th className="p-4">Details</th><th className="p-4">Total</th><th className="p-4">Action</th></tr>
                   </thead>
                   <tbody className="divide-y dark:divide-slate-800">
                      {enrichedSales.slice().reverse().map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                             <td className="p-4"><input type="checkbox" checked={selectedTransactions.has(sale.id)} onChange={() => toggleSelection(sale.id)} className="w-5 h-5 rounded text-amber-500" /></td>
                             <td className="p-4 text-xs font-bold">{new Date(sale.timestamp).toLocaleDateString(language)}</td>
                             <td className="p-4"><p className="text-sm font-bold">{sale.staffName}</p><p className="text-xs text-slate-400">{sale.customerName}</p></td>
                             <td className="p-4 font-black">{currency}{sale.total.toFixed(2)}</td>
                             <td className="p-4"><button onClick={() => setViewingSale(sale)} className="text-amber-500 font-bold text-xs">View</button></td>
                          </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div key="ex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800">
                <form onSubmit={handleAddExpenseSubmit} className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <input type="text" placeholder={t.category} value={newExp.category} onChange={e => setNewExp({...newExp, category: e.target.value})} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm" required />
                      <input type="number" placeholder={t.amount} value={newExp.amount} onChange={e => setNewExp({...newExp, amount: e.target.value})} className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm" required />
                   </div>
                   <input type="text" placeholder={t.description} value={newExp.description} onChange={e => setNewExp({...newExp, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 text-sm" />
                   <div className="flex gap-4">
                      <label className="flex-1 cursor-pointer bg-slate-50 dark:bg-slate-800 border-2 border-dashed rounded-xl p-3 text-center text-slate-400 text-xs font-bold">
                          {newExp.receiptImage ? '✅ Attached' : '📸 Image'}
                          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                      </label>
                      <button type="submit" className="flex-1 bg-amber-500 text-slate-900 py-3 rounded-xl font-black uppercase text-xs">Save</button>
                   </div>
                </form>
             </div>
             <div className="space-y-3">
                {expenses.slice().reverse().map(exp => (
                   <div key={exp.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">🧾</div>
                         <div><p className="font-bold">{exp.category}</p><p className="text-[10px] opacity-50">{exp.date}</p></div>
                      </div>
                      <div className="text-right">
                         <p className="font-black text-rose-500">{currency}{exp.amount.toFixed(2)}</p>
                         <button onClick={() => onDeleteExpense(exp.id)} className="text-[10px] text-slate-400">Delete</button>
                      </div>
                   </div>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{viewingSale && renderReceiptModal()}</AnimatePresence>
    </div>
  );
};

export default Finance;


import React from 'react';
import { Sale, Expense, Language, Product, View } from '../types';
import { TRANSLATIONS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';

interface DashboardProps {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  currency: string;
  language: Language;
  onNavigate: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ sales, expenses, products, currency, language, onNavigate }) => {
  const t = TRANSLATIONS[language];
  const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const averageTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  const lowStockItems = products.filter(p => p.stock <= (p.lowStockThreshold || 15));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const chartData = last7Days.map(date => ({
    date: date.split('-').slice(1).join('/'),
    revenue: sales
      .filter(s => s.timestamp.startsWith(date))
      .reduce((acc, s) => acc + s.total, 0)
  }));

  const stats = [
    { label: t.revenue, value: `${currency}${totalRevenue.toLocaleString()}`, icon: '💰', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' },
    { label: t.expenses, value: `${currency}${totalExpenses.toLocaleString()}`, icon: '💸', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' },
    { label: t.netProfit, value: `${currency}${netProfit.toLocaleString()}`, icon: '📈', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20' },
    { label: t.avgTicket, value: `${currency}${averageTicket.toFixed(2)}`, icon: '🎟️', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl text-xs font-bold shadow-xl border border-slate-700">
          <p className="mb-1 text-slate-400">{label}</p>
          <p>{currency}{payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white font-brand tracking-tight">{t.performanceInsights}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm md:text-base">{t.welcomeBack}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 hidden sm:flex items-center gap-3">
            <span className="text-slate-300 font-bold text-xs md:text-sm tracking-tight">{new Date().toLocaleDateString(language, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, idx) => (
          <motion.div 
            key={idx} whileHover={{ y: -5 }}
            className={`bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2 md:gap-4 relative overflow-hidden`}
          >
            <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg md:text-2xl ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-lg md:text-2xl font-black text-slate-900 dark:text-white truncate">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
           <div className="flex items-center gap-4 w-full">
              <div className="w-10 h-10 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center text-xl shrink-0">⚠️</div>
              <div className="min-w-0 flex-1">
                 <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">{t.lowStockAlerts}</h3>
                 <p className="text-[11px] text-rose-600/80 dark:text-rose-400/70 font-medium truncate">{lowStockItems.length} items need attention</p>
              </div>
              <button onClick={() => onNavigate(View.INVENTORY)} className="bg-rose-500 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wide shrink-0">{t.restockNow}</button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-500 rounded-full"></div>{t.revenueTrends}
          </h3>
          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-5" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(val) => `${currency}${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} dot={{fill: '#f59e0b', r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{t.recentTransactions}</h3>
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px] scrollbar-hide">
            {sales.slice(-5).reverse().map((sale) => (
              <div key={sale.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${sale.paymentMethod === 'card' ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
                    {sale.paymentMethod === 'card' ? '💳' : '💵'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">#{sale.id.slice(-4)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{currency}{sale.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="text-center py-10 text-slate-300 italic text-sm">{t.waitingForSale}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

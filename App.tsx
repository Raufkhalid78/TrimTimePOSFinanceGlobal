
import React, { useState, useEffect, ReactNode, ErrorInfo, Component } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Finance from './components/Finance';
import Customers from './components/Customers';
import Settings from './components/Settings';
import Inventory from './components/Inventory';
import StaffManagement from './components/StaffManagement';
import Login from './components/Login';
import Paywall from './components/Paywall';
import InstallBanner from './components/InstallBanner';
import Onboarding from './components/Onboarding';
import { View, Sale, Expense, Service, Product, Staff, Customer, ShopSettings, Language } from './types';
import { INITIAL_SERVICES, INITIAL_PRODUCTS, INITIAL_STAFF, INITIAL_CUSTOMERS, DEFAULT_SETTINGS } from './constants';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Error Boundary to prevent white screens
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center text-3xl mb-4">
            ⚠️
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">We encountered an unexpected error loading this section.</p>
          <button 
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg active:scale-95 transition-transform"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('active');
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [sessionLanguage, setSessionLanguage] = useState<Language>(() => (localStorage.getItem('trimtime_lang') as Language) || 'en');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('trimtime_theme') === 'dark');
  
  // PWA Install States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // --- AUTH & SESSION MANAGEMENT ---
  useEffect(() => {
    const restoreSession = async (userId: string) => {
      try {
          setIsSessionLoading(true);
          
          // 1. Fetch Shop & Subscription & Onboarding Status
          const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('id, subscription_status, onboarding_completed')
            .eq('owner_id', userId)
            .single();
            
          if (shop) {
             setSubscriptionStatus(shop.subscription_status || 'active');
             
             // Check onboarding status
             setIsOnboarding(shop.onboarding_completed === false);
             
             // 2. Fetch Admin Profile
             // RLS ensures we only see staff for this shop
             const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('*')
                .eq('shop_id', shop.id)
                .eq('role', 'admin')
                .limit(1)
                .maybeSingle();
                
             if (staffData) {
                 setCurrentUser({ ...staffData, shopId: shop.id }); // Ensure shopId is present
                 setCurrentView(View.DASHBOARD);
             }
          }
      } catch (e) {
          console.error("Session restore error", e);
      } finally {
          setIsSessionLoading(false);
      }
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
          restoreSession(session.user.id);
      } else {
          setIsSessionLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await restoreSession(session.user.id);
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setSubscriptionStatus('active');
            setIsOnboarding(false);
            setIsSessionLoading(false);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data only when authenticated
  useEffect(() => {
    if (!currentUser || isOnboarding) {
        setLoading(false);
        return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [sv, pr, st, ex, cu, sa, se] = await Promise.all([
          supabase.from('services').select('*'),
          supabase.from('products').select('*'),
          supabase.from('staff').select('*'),
          supabase.from('expenses').select('*'),
          supabase.from('customers').select('*'),
          supabase.from('sales').select('*'),
          supabase.from('settings').select('*').maybeSingle()
        ]);

        // --- SERVICES ---
        if (sv.data) setServices(sv.data);
        else if (sv.error) console.error("Services Error:", sv.error);

        // --- PRODUCTS ---
        if (pr.data) setProducts(pr.data.map((p: any) => ({ ...p, lowStockThreshold: p.low_stock_threshold })));
        else if (pr.error) console.error("Products Error:", pr.error);

        // --- STAFF ---
        if (st.data) setStaff(st.data);
        else if (st.error) console.error("Staff Error:", st.error);

        // --- EXPENSES ---
        if (ex.data) setExpenses(ex.data.map((e: any) => ({ ...e, receiptImage: e.receipt_image })));
        
        // --- CUSTOMERS ---
        if (cu.data) setCustomers(cu.data.map((c: any) => ({ ...c, createdAt: c.created_at })));
        
        // --- SALES ---
        if (sa.data) {
          setSales(sa.data.map((s: any) => ({ 
            ...s, 
            items: (typeof s.items === 'string' ? JSON.parse(s.items) : s.items) || [],
            staffName: s.professional_name,
            customerName: s.customer_name
          })));
        }
        
        // --- SETTINGS ---
        if (se.data?.data) {
            setSettings({ ...DEFAULT_SETTINGS, ...se.data.data });
        }
        
      } catch (e) { 
          console.error("Fatal Error loading data:", e); 
      } finally { 
          setLoading(false); 
      }
    };
    fetchData();
  }, [currentUser, isOnboarding]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('trimtime_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.lang = sessionLanguage;
    document.dir = ['ur', 'fa'].includes(sessionLanguage) ? 'rtl' : 'ltr';
    localStorage.setItem('trimtime_lang', sessionLanguage);
  }, [sessionLanguage]);

  // --- DATABASE SYNC HANDLERS ---

  const handleUpdateServices = async (updated: Service[]) => {
    const currentIds = new Set<string>(services.map(i => i.id));
    const newIds = new Set<string>(updated.map(i => i.id));
    const toDelete: string[] = Array.from(currentIds).filter(id => !newIds.has(id));
    setServices(updated);
    
    // Explicitly map columns and inject shop_id
    const dbRows = updated.map(s => ({
        id: s.id,
        shop_id: currentUser?.shopId,
        name: s.name,
        price: s.price,
        duration: s.duration,
        category: s.category
    }));

    try {
      if (toDelete.length) await supabase.from('services').delete().in('id', toDelete);
      if (updated.length) {
          const { error } = await supabase.from('services').upsert(dbRows);
          if (error) throw error;
      }
    } catch (error) { console.error("DB Sync Error (Services):", error); alert("Failed to sync services."); }
  };

  const handleUpdateProducts = async (updated: Product[]) => {
    const currentIds = new Set<string>(products.map(i => i.id));
    const newIds = new Set<string>(updated.map(i => i.id));
    const toDelete: string[] = Array.from(currentIds).filter(id => !newIds.has(id));
    setProducts(updated);
    
    const dbRowsFull = updated.map(p => ({
        id: p.id,
        shop_id: currentUser?.shopId,
        name: p.name,
        price: p.price,
        cost: p.cost,
        stock: p.stock,
        barcode: p.barcode || null,
        low_stock_threshold: p.lowStockThreshold || 15
    }));
    try {
      if (toDelete.length) await supabase.from('products').delete().in('id', toDelete);
      if (dbRowsFull.length) {
          const { error } = await supabase.from('products').upsert(dbRowsFull);
          if (error) throw error;
      }
    } catch (error) { console.error("DB Sync Error (Products):", error); alert("Failed to sync products."); }
  };

  const handleUpdateStaff = async (updated: Staff[]) => {
    const currentIds = new Set<string>(staff.map(i => i.id));
    const newIds = new Set<string>(updated.map(i => i.id));
    const toDelete: string[] = Array.from(currentIds).filter(id => !newIds.has(id));
    setStaff(updated);
    
    const dbRows = updated.map(s => ({
        id: s.id,
        shop_id: currentUser?.shopId,
        name: s.name,
        role: s.role,
        commission: s.commission,
        username: s.username,
        password: s.password,
        email: s.email
    }));

    try {
      if (toDelete.length) await supabase.from('staff').delete().in('id', toDelete);
      if (updated.length) {
          const { error } = await supabase.from('staff').upsert(dbRows);
          if (error) throw error;
      }
    } catch (error) { console.error("DB Sync Error (Staff):", error); alert("Failed to sync staff."); }
  };

  const handleUpdateCustomers = async (updated: Customer[]) => {
    const currentIds = new Set<string>(customers.map(i => i.id));
    const newIds = new Set<string>(updated.map(i => i.id));
    const toDelete: string[] = Array.from(currentIds).filter(id => !newIds.has(id));
    setCustomers(updated);
    const dbRows = updated.map(c => ({
        id: c.id,
        shop_id: currentUser?.shopId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
        created_at: c.createdAt
    }));
    try {
      if (toDelete.length) await supabase.from('customers').delete().in('id', toDelete);
      if (dbRows.length) {
          const { error } = await supabase.from('customers').upsert(dbRows);
          if (error) throw error;
      }
    } catch (error) { console.error("DB Sync Error (Customers):", error); alert("Failed to sync customers."); }
  };

  const handleUpdateSettings = async (updated: ShopSettings) => {
    setSettings(updated);
    try {
      // Settings table is 1:1 with shops, keyed by shop_id
      if (currentUser?.shopId) {
          const { error } = await supabase.from('settings').update({ data: updated }).eq('shop_id', currentUser.shopId);
          if (error) throw error;
      }
    } catch (error) { console.error("DB Sync Error (Settings):", error); }
  };

  const handleCompleteSale = async (sale: Sale) => {
    setSales(prev => [...prev, sale]);
    const dbSale = {
        id: sale.id,
        shop_id: currentUser?.shopId,
        timestamp: sale.timestamp,
        items: sale.items, 
        staff_id: sale.staffId,
        customer_id: sale.customerId,
        total: sale.total,
        tax: sale.tax,
        discount: sale.discount,
        discount_code: sale.discountCode,
        payment_method: sale.paymentMethod,
        tax_type: sale.taxType,
        customer_name: sale.customerName,
        professional_name: sale.staffName
    };
    try {
      const { error: saleError } = await supabase.from('sales').insert(dbSale);
      if (saleError) throw saleError;
      let productsUpdated = false;
      const newProducts = [...products];
      sale.items.forEach(item => {
          if (item.type === 'product') {
              const idx = newProducts.findIndex(p => p.id === item.id);
              if (idx > -1) {
                  const newStock = Math.max(0, newProducts[idx].stock - item.quantity);
                  newProducts[idx] = { ...newProducts[idx], stock: newStock };
                  productsUpdated = true;
              }
          }
      });
      if (productsUpdated) handleUpdateProducts(newProducts);
    } catch (error) { console.error("DB Sync Error (Sale):", error); alert("Transaction completed but failed to save to cloud."); }
  };

  const handleDeleteSales = async (ids: string[]) => {
    setSales(prev => prev.filter(s => !ids.includes(s.id)));
    try {
      const { error } = await supabase.from('sales').delete().in('id', ids);
      if (error) throw error;
    } catch (error) { console.error("DB Sync Error (Delete Sales):", error); alert("Failed to delete sales."); }
  };

  const handleAddExpense = async (expense: Expense) => {
      setExpenses(prev => [...prev, expense]);
      const dbExpense = {
          id: expense.id,
          shop_id: currentUser?.shopId,
          date: expense.date,
          category: expense.category,
          amount: expense.amount,
          description: expense.description || '',
          receipt_image: expense.receiptImage || null
      };
      try {
        const { error } = await supabase.from('expenses').insert(dbExpense);
        if (error) throw error;
      } catch (error) { console.error("DB Sync Error (Expense):", error); alert("Failed to save expense."); }
  };

  const handleDeleteExpense = async (id: string) => {
      setExpenses(prev => prev.filter(e => e.id !== id));
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
      } catch (error) { console.error("DB Sync Error (Delete Expense):", error); alert("Failed to delete expense."); }
  };
  
  const handlePurgeSales = async () => {
    setSales([]);
    try {
       // Only delete for current shop via RLS, but explicit filter is safer
       const { error } = await supabase.from('sales').delete().neq('id', '0'); 
       if (error) throw error;
    } catch (error) { console.error("DB Sync Error (Purge Sales):", error); alert("Failed to purge sales."); }
  };

  const handleLogin = (user: Staff, remember: boolean) => {
    setCurrentUser(user);
    setCurrentView(user.role === 'employee' ? View.POS : View.DASHBOARD);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const handleSubscriptionSuccess = () => {
    setSubscriptionStatus('active');
  };

  if (isSessionLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>;

  if (!currentUser) return <Login onLogin={handleLogin} staffList={staff} shopName={settings.shopName} />;

  // Paywall Logic
  if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
      return <Paywall currentUser={currentUser} onSuccess={handleSubscriptionSuccess} shopName={settings.shopName} />;
  }

  // Onboarding Logic
  if (isOnboarding && currentUser.role === 'admin') {
      return <Onboarding currentUser={currentUser} initialSettings={settings} onComplete={() => { setIsOnboarding(false); window.location.reload(); }} />;
  }

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div></div>;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-300">
      <Sidebar 
        currentView={currentView} onViewChange={setCurrentView} 
        shopName={settings.shopName} userRole={currentUser.role} 
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        language={sessionLanguage} onLanguageChange={setSessionLanguage}
      />

      <div className="flex-1 flex flex-col min-w-0 md:pl-64 overflow-hidden relative">
        {/* Responsive Header */}
        <header className="flex md:hidden items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-50 sticky top-0 shadow-sm">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-brand text-lg text-slate-950">{settings.shopName.charAt(0)}</div>
             <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{settings.shopName}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg">
              {isDarkMode ? '🌞' : '🌙'}
            </button>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-900 dark:text-white bg-amber-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7"/></svg>
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex justify-between items-center px-8 py-6 no-print">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white font-brand">{tView(currentView, sessionLanguage)}</h1>
            <div className="flex items-center gap-4">
               <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-white dark:bg-slate-900 text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800">
                 {isDarkMode ? '🌞' : '🌙'}
               </button>
               <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 pr-4 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xs">{currentUser.name.charAt(0)}</div>
                  <div className="flex flex-col"><span className="text-xs font-bold dark:text-white">{currentUser.name}</span><span className="text-[9px] uppercase font-black text-slate-400">{currentUser.role}</span></div>
               </div>
               <button onClick={handleLogout} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl">🚪</button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative scrollbar-hide">
          <AnimatePresence mode='wait'>
            <motion.div key={currentView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ErrorBoundary key={String(currentView)}>
                {renderView(currentView, { 
                  sales, expenses, products, services, staff, customers, settings, 
                  currentUser, sessionLanguage, isDarkMode, 
                  // DB Handlers passed to children
                  onUpdateServices: handleUpdateServices,
                  onUpdateProducts: handleUpdateProducts,
                  onUpdateStaff: handleUpdateStaff,
                  onUpdateCustomers: handleUpdateCustomers,
                  onUpdateSettings: handleUpdateSettings,
                  onCompleteSale: handleCompleteSale,
                  onAddExpense: handleAddExpense,
                  onDeleteExpense: handleDeleteExpense,
                  onLogout: handleLogout,
                  onPurgeSales: handlePurgeSales,
                  onDeleteSales: handleDeleteSales,
                  
                  setCurrentView, handleLogout
                })}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <InstallBanner 
        deferredPrompt={deferredPrompt} 
        onClose={() => setDeferredPrompt(null)} 
      />
    </div>
  );
};

const tView = (v: View, l: Language) => {
  const map: any = { 
    en: { [View.DASHBOARD]: 'Dashboard', [View.POS]: 'Terminal', [View.FINANCE]: 'Finances', [View.INVENTORY]: 'Catalog', [View.STAFF]: 'Staff', [View.CUSTOMERS]: 'Clients', [View.SETTINGS]: 'Settings' },
    ur: { [View.DASHBOARD]: 'ڈیش بورڈ', [View.POS]: 'ٹرمینل', [View.FINANCE]: 'مالیات', [View.INVENTORY]: 'کیٹلاگ', [View.STAFF]: 'عملہ', [View.CUSTOMERS]: 'صارفین', [View.SETTINGS]: 'ترتیبات' },
    fa: { [View.DASHBOARD]: 'داشبورد', [View.POS]: 'پایانه', [View.FINANCE]: 'مالی', [View.INVENTORY]: 'موجودی', [View.STAFF]: 'پرسنل', [View.CUSTOMERS]: 'مشتریان', [View.SETTINGS]: 'تنظیمات' },
    hi: { [View.DASHBOARD]: 'डैशबोर्ड', [View.POS]: 'टर्मिनल', [View.FINANCE]: 'वित्त', [View.INVENTORY]: 'कैटलॉग', [View.STAFF]: 'स्टाफ', [View.CUSTOMERS]: 'ग्राहक', [View.SETTINGS]: 'सेटिंग्स' }
  };
  return map[l]?.[v] || map['en'][v];
};

const renderView = (v: View, props: any) => {
  const { sales, expenses, products, services, staff, customers, settings, currentUser, sessionLanguage, onUpdateServices, onUpdateProducts, onUpdateStaff, onUpdateCustomers, onUpdateSettings, onCompleteSale, onAddExpense, onDeleteExpense, onLogout, onPurgeSales, onDeleteSales, setCurrentView } = props;
  switch (v) {
    case View.DASHBOARD: return <Dashboard sales={sales} expenses={expenses} products={products} currency={settings.currency} language={sessionLanguage} onNavigate={setCurrentView} />;
    case View.POS: return <POS services={services} products={products} staff={staff} customers={customers} settings={settings} currentUser={currentUser} onCompleteSale={onCompleteSale} onAddCustomer={c => onUpdateCustomers([...customers, c])} />;
    case View.FINANCE: return <Finance sales={sales} expenses={expenses} staffList={staff} customers={customers} currency={settings.currency} language={sessionLanguage} currentUser={currentUser} onAddExpense={onAddExpense} onDeleteExpense={onDeleteExpense} onDeleteSales={onDeleteSales} settings={settings} />;
    case View.CUSTOMERS: return <Customers customers={customers} sales={sales} onUpdateCustomers={onUpdateCustomers} currency={settings.currency} language={sessionLanguage} />;
    case View.INVENTORY: return <Inventory services={services} products={products} settings={{...settings, language: sessionLanguage}} onUpdateServices={onUpdateServices} onUpdateProducts={onUpdateProducts} />;
    case View.STAFF: return <StaffManagement staffList={staff} onUpdateStaff={onUpdateStaff} currentUser={currentUser} language={sessionLanguage} />;
    case View.SETTINGS: return <Settings settings={{...settings, language: sessionLanguage}} onUpdateSettings={onUpdateSettings} currentUser={currentUser} onLogout={onLogout} onPurgeSales={onPurgeSales} />;
    default: return null;
  }
};

export default App;

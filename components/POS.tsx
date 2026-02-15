
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Service, Product, Staff, Sale, SaleItem, Customer, ShopSettings, HeldSale } from '../types';
import { TRANSLATIONS, COUNTRY_CODES } from '../constants';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface POSProps {
  services: Service[];
  products: Product[];
  staff: Staff[];
  customers: Customer[];
  settings: ShopSettings;
  currentUser: Staff;
  onCompleteSale: (sale: Sale) => void;
  onAddCustomer: (customer: Customer) => void;
}

const POS: React.FC<POSProps> = ({ services, products, staff, customers, settings, currentUser, onCompleteSale, onAddCustomer }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>(currentUser.role === 'employee' ? currentUser.id : '');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
  const [searchTerm, setSearchTerm] = useState('');
  // Load held sales from local storage to persist across refreshes
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => {
    try {
      const saved = localStorage.getItem('trimtime_held_sales');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [autoWhatsapp, setAutoWhatsapp] = useState(false);
  
  const [scanningFeedback, setScanningFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', email: '' });
  const [isScanning, setIsScanning] = useState(false);
  
  // Payment states
  const [paymentMode, setPaymentMode] = useState<'default' | 'cash'>('default');
  const [cashReceived, setCashReceived] = useState<string>('');

  const feedbackTimeoutRef = useRef<number | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScannerActiveRef = useRef(false);
  const processingScanRef = useRef(false);
  
  const t = TRANSLATIONS[settings.language];

  // Persist held sales whenever they change
  useEffect(() => {
    localStorage.setItem('trimtime_held_sales', JSON.stringify(heldSales));
  }, [heldSales]);

  // Set default phone code when opening modal
  useEffect(() => {
      if (isAddingCustomer && !newCustomerData.phone) {
          setNewCustomerData(prev => ({...prev, phone: settings.defaultCountryCode || ''}));
      }
  }, [isAddingCustomer, settings.defaultCountryCode]);

  const activeCustomer = useMemo(() => customers.find(c => c.id === selectedCustomer), [selectedCustomer, customers]);
  const lastCustomer = useMemo(() => lastSale?.customerId ? customers.find(c => c.id === lastSale.customerId) : null, [lastSale, customers]);

  const sendWhatsappReceipt = (sale: Sale, customer: Customer) => {
    if (!customer.phone) return;
    const itemsList = sale.items.map(i => `• *${i.name}* (${settings.currency}${i.price} x ${i.quantity})`).join('\n');
    const message = `✨ *${settings.shopName} Receipt* ✨\n\n` +
      `👤 *Customer:* ${customer.name}\n` +
      `📅 *Date:* ${new Date(sale.timestamp).toLocaleDateString()}\n` +
      `🧾 *ID:* #${sale.id.slice(0, 8)}\n` +
      `--------------------------\n` +
      `${itemsList}\n` +
      `--------------------------\n` +
      `💰 *Total:* ${settings.currency}${sale.total.toFixed(2)}\n` +
      `💳 *Method:* ${sale.paymentMethod.toUpperCase()}\n\n` +
      `${settings.receiptFooter}\n\n` +
      `_Thank you for your visit!_`;
    const cleanPhone = customer.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  useEffect(() => {
    let isMounted = true;

    const cleanupScanner = async () => {
        if (!html5QrCodeRef.current) return;
        try {
            if (isScannerActiveRef.current) {
                await html5QrCodeRef.current.stop();
            }
        } catch (e) {
            console.warn("POS Scanner stop error", e);
        } finally {
            isScannerActiveRef.current = false;
            try { await html5QrCodeRef.current.clear(); } catch(e) {}
            html5QrCodeRef.current = null;
        }
    };

    if (isScanning) {
        const startScanner = async () => {
            await new Promise(resolve => setTimeout(resolve, 600));
            if (!isMounted || !isScanning) return;
            
            if (!document.getElementById("reader")) return;
            
            await cleanupScanner();

            try {
                const html5QrCode = new Html5Qrcode("reader", {
                  formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.QR_CODE
                  ],
                  verbose: false
                });
                
                html5QrCodeRef.current = html5QrCode;
                
                await html5QrCode.start(
                    { facingMode: "environment" }, 
                    { 
                        fps: 15, 
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const width = Math.floor(viewfinderWidth * 0.85);
                            const height = Math.floor(viewfinderHeight * 0.35);
                            return { width, height };
                        },
                        aspectRatio: 1.777778,
                        experimentalFeatures: {
                            useBarCodeDetectorIfSupported: true
                        }
                    }, 
                    (decodedText) => { if (isMounted) handleScan(decodedText); },
                    () => {} 
                );
                
                isScannerActiveRef.current = true;

                if (!isMounted) {
                    await cleanupScanner();
                }
            } catch (err: any) {
                const isPermissionError = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.message?.includes('Permission');
                
                if (isMounted) {
                  if (isPermissionError) {
                      setScanningFeedback(t.cameraPermission);
                      console.warn("POS Camera permission denied");
                  } else {
                      setScanningFeedback(t.cameraError);
                      console.error("Scanner startup error:", err);
                  }
                  setFeedbackType("error");
                  setTimeout(() => setIsScanning(false), 2000);
                }
                await cleanupScanner();
            }
        };
        startScanner();
    }
    
    // Cleanup function
    return () => {
        isMounted = false;
        // Trigger async cleanup without awaiting
        if (html5QrCodeRef.current) {
             const scanner = html5QrCodeRef.current;
             const wasActive = isScannerActiveRef.current;
             
             if (wasActive) {
                 scanner.stop().catch((e) => console.warn("POS Stop failed during unmount", e))
                 .finally(() => {
                    try { scanner.clear(); } catch(e) {}
                    isScannerActiveRef.current = false;
                 });
             } else {
                 try { scanner.clear(); } catch(e) {}
             }
        }
    };
  }, [isScanning, settings.language]); // Restart scanner if language changes to update feedback text

  const handleScan = (barcode: string) => {
    if (processingScanRef.current) return;
    processingScanRef.current = true;
    
    const product = products.find(p => p.barcode === barcode);
    if (product) {
        if ("vibrate" in navigator) navigator.vibrate(100);
        addToCart(product, 'product');
        setScanningFeedback(`${t.added}: ${product.name}`);
        setFeedbackType('success');
        
        if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => { 
            setScanningFeedback(null); 
            processingScanRef.current = false;
        }, 1500); 
    } else {
        if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
        setScanningFeedback(`${t.unknownProduct}: ${barcode}`);
        setFeedbackType('error');
        
        if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = window.setTimeout(() => { 
            setScanningFeedback(null); 
            processingScanRef.current = false;
        }, 3500);
    }
  };

  const toggleScanner = () => setIsScanning(!isScanning);

  const addToCart = (item: Service | Product, type: 'service' | 'product') => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === type);
      if (existing) {
        return prev.map(i => i.id === item.id && i.type === type ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, type, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, type: 'service' | 'product', delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.type === type) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const removeFromCart = (id: string, type: 'service' | 'product') => {
    setCart(prev => prev.filter(i => !(i.id === id && i.type === type)));
  };

  const totals = useMemo(() => {
    const rawSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    let discount = 0;
    const code = (settings.promoCodes || []).find(c => c.code === discountCode);
    if (code) discount = code.type === 'percentage' ? (rawSubtotal * code.value) / 100 : code.value;
    const discountedAmount = rawSubtotal - discount;
    let tax = 0;
    let total = 0;
    if (settings.taxType === 'included') {
      total = discountedAmount;
      tax = total - (total / (1 + (settings.taxRate / 100)));
    } else {
      tax = discountedAmount * (settings.taxRate / 100);
      total = discountedAmount + tax;
    }
    return { subtotal: rawSubtotal, discount, tax, total };
  }, [cart, discountCode, settings]);

  const handleHoldSale = () => {
    if (cart.length === 0) return;
    const newHold: HeldSale = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      cart: [...cart],
      customerId: selectedCustomer || undefined,
      staffId: selectedStaff || undefined,
    };
    setHeldSales([newHold, ...heldSales]);
    setCart([]);
    setSelectedCustomer('');
    if (currentUser.role !== 'employee') setSelectedStaff('');
  };

  const retrieveSale = (held: HeldSale) => {
    setCart(held.cart);
    if (held.customerId) setSelectedCustomer(held.customerId);
    if (held.staffId) setSelectedStaff(held.staffId);
    setHeldSales(heldSales.filter(h => h.id !== held.id));
    setShowMobileCart(true); // Open cart to show retrieved items
  };

  const deleteHeldSale = (id: string) => {
    if(confirm(t.discardBill)) {
      setHeldSales(prev => prev.filter(h => h.id !== id));
    }
  };

  const handleShareReceipt = async (sale: Sale) => {
    // Dynamic height calculation: Base 120mm + 5mm per item
    const docHeight = 120 + (sale.items.length * 6);
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, docHeight] 
    });

    const centerX = 40;
    let y = 10;

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(settings.shopName, centerX, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Premium Grooming Services", centerX, y, { align: 'center' });
    y += 6;

    // Meta
    const dateStr = new Date(sale.timestamp).toLocaleDateString(settings.language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(dateStr, centerX, y, { align: 'center' });
    y += 4;
    doc.text(`Receipt #${sale.id.slice(0, 8)}`, centerX, y, { align: 'center' });
    y += 5;

    // Divider
    doc.setLineWidth(0.2);
    doc.line(5, y, 75, y);
    y += 5;

    // --- Customer/Staff Info ---
    doc.setFontSize(9);
    const staffName = sale.staffName || staff.find(s => s.id === sale.staffId)?.name || 'Staff';
    doc.text(`Pro: ${staffName}`, 5, y);
    y += 4;
    
    const clientName = sale.customerName || customers.find(c => c.id === sale.customerId)?.name || 'Walk-in Client';
    doc.text(`Client: ${clientName}`, 5, y);
    y += 5;

    doc.line(5, y, 75, y);
    y += 5;

    // --- Items Header ---
    doc.setFont("helvetica", "bold");
    doc.text("Item", 5, y);
    doc.text("Price", 75, y, { align: "right" });
    y += 5;
    
    // --- Items List ---
    doc.setFont("helvetica", "normal");
    sale.items.forEach(item => {
        const itemName = `${item.quantity}x ${item.name}`;
        // Wrap long names
        const splitName = doc.splitTextToSize(itemName, 45);
        doc.text(splitName, 5, y);
        
        const priceStr = `${settings.currency}${(item.price * item.quantity).toFixed(2)}`;
        doc.text(priceStr, 75, y, { align: "right" });
        
        // Adjust Y based on lines used by name
        y += (splitName.length * 4) + 1; 
    });

    y += 2;
    doc.line(5, y, 75, y);
    y += 5;

    // --- Totals ---
    const rightCol = 75;
    const labelCol = 45;

    doc.text("Subtotal:", labelCol, y, { align: "right" });
    const subtotal = sale.total - sale.tax + sale.discount;
    doc.text(`${settings.currency}${subtotal.toFixed(2)}`, rightCol, y, { align: "right" });
    y += 4;

    if (sale.discount > 0) {
        doc.text("Discount:", labelCol, y, { align: "right" });
        doc.text(`-${settings.currency}${sale.discount.toFixed(2)}`, rightCol, y, { align: "right" });
        y += 4;
    }

    if (sale.tax > 0) {
        doc.text(`Tax (${settings.taxRate}%):`, labelCol, y, { align: "right" });
        doc.text(`${settings.currency}${sale.tax.toFixed(2)}`, rightCol, y, { align: "right" });
        y += 4;
    }

    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL:", labelCol, y, { align: "right" });
    doc.text(`${settings.currency}${sale.total.toFixed(2)}`, rightCol, y, { align: "right" });
    y += 7;

    // --- Payment Info ---
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`PAID VIA ${sale.paymentMethod.toUpperCase()}`, centerX, y, { align: "center" });
    y += 6;

    // --- Footer ---
    doc.setFont("helvetica", "italic");
    const footerLines = doc.splitTextToSize(settings.receiptFooter || "Thank you for your business!", 70);
    doc.text(footerLines, centerX, y, { align: "center" });
    
    doc.save(`Receipt-${sale.id}.pdf`);
  };

  const handleCheckout = (paymentMethod: 'cash' | 'card' | 'wallet') => {
    if (cart.length === 0 || !selectedStaff) {
      alert(t.fillOrder);
      return;
    }
    const staffMember = staff.find(s => s.id === selectedStaff);
    const customerMember = customers.find(c => c.id === selectedCustomer);
    const sale: Sale = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      items: [...cart],
      staffId: selectedStaff,
      customerId: selectedCustomer || undefined,
      total: totals.total,
      tax: totals.tax,
      discount: totals.discount,
      discountCode: discountCode || undefined,
      paymentMethod,
      taxType: settings.taxType,
      staffName: staffMember?.name || 'Unknown',
      customerName: customerMember?.name || (selectedCustomer ? 'Unknown' : undefined)
    };
    onCompleteSale(sale);
    setLastSale(sale);
    if (autoWhatsapp && selectedCustomer) {
      const cust = customers.find(c => c.id === selectedCustomer);
      if (cust && cust.phone) setTimeout(() => sendWhatsappReceipt(sale, cust), 1200);
    }
    setCart([]);
    setSelectedCustomer('');
    setDiscountCode('');
    setPaymentMode('default');
    setCashReceived('');
    if (currentUser.role !== 'employee') setSelectedStaff('');
    setShowMobileCart(false);
  };
  
  const saveNewCustomer = () => {
      if(!newCustomerData.name) return;
      const newCustomer: Customer = {
          id: 'c' + Date.now().toString(36),
          name: newCustomerData.name,
          phone: newCustomerData.phone,
          email: newCustomerData.email,
          notes: '',
          createdAt: new Date().toISOString()
      };
      onAddCustomer(newCustomer);
      setSelectedCustomer(newCustomer.id);
      setIsAddingCustomer(false);
      setNewCustomerData({ name: '', phone: '', email: '' });
  };

  const filteredItems = useMemo(() => {
    const search = searchTerm.toLowerCase();
    if (activeTab === 'services') return services.filter(s => s.name.toLowerCase().includes(search) || s.category.toLowerCase().includes(search));
    return products.filter(p => p.name.toLowerCase().includes(search));
  }, [activeTab, services, products, searchTerm]);

  // Cash change logic
  const cashChange = useMemo(() => {
      const received = parseFloat(cashReceived) || 0;
      return received - totals.total;
  }, [cashReceived, totals.total]);

  const replaceCountryCode = (newCode: string) => {
      const current = newCustomerData.phone;
      let newPhone = current;
      if (current.startsWith('+')) {
          const match = current.match(/^(\+\d+)/);
          if (match) {
              newPhone = current.replace(match[1], newCode);
          } else {
              newPhone = newCode + current;
          }
      } else {
          newPhone = newCode + current;
      }
      setNewCustomerData({ ...newCustomerData, phone: newPhone });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      {/* Held Sales Sidebar/Indicator (Optional for Desktop) */}
      {heldSales.length > 0 && (
         <div className="absolute top-0 right-0 z-10 p-2 hidden lg:block">
            <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 shadow-sm">
               {heldSales.length} {t.heldBills}
            </div>
         </div>
      )}

      <AnimatePresence>
        {lastSale && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[150] flex items-center justify-center p-6 no-print">
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl text-center space-y-8">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center text-3xl md:text-4xl mx-auto shadow-inner">✓</div>
              <div className="space-y-2">
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t.saleSuccess}</h3>
                <p className="text-slate-400 dark:text-slate-500 font-medium">{t.orderCompleted}</p>
              </div>
              <div className="flex flex-col gap-3">
                {lastCustomer && lastCustomer.phone && (
                  <button onClick={() => sendWhatsappReceipt(lastSale, lastCustomer)} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 text-sm md:text-base">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.224-3.52c1.54.914 3.453 1.403 5.385 1.404h.005c5.632 0 10.211-4.579 10.214-10.211 0-2.729-1.063-5.295-2.993-7.225s-4.496-2.992-7.225-2.993c-5.633 0-10.213 4.58-10.214 10.214 0 2.022.529 3.996 1.531 5.74l-.991 3.618 3.707-.972zm11.233-5.62c-.301-.151-1.782-.879-2.057-.979-.275-.1-.475-.151-.675.151s-.777.979-.952 1.179-.35.225-.65.076c-.301-.151-1.268-.467-2.417-1.492-.892-.795-1.494-1.777-1.669-2.078-.175-.301-.019-.463.131-.613.135-.134.301-.351.451-.526s.201-.3.301-.5.101-.201.05-.376-.025-.526s-.675-1.629-.925-2.229c-.244-.583-.491-.504-.675-.513-.175-.008-.376-.01-.576-.01s-.526.076-.801.376c-.275.301-1.051 1.028-1.051 2.508s1.076 2.908 1.226 3.109c.151.201 2.118 3.235 5.132 4.537.717.309 1.277.494 1.714.633.72.228 1.375.196 1.892.119.577-.085 1.782-.728 2.032-1.429s.25-.151.25-.376-.101-.351-.401-.502z"/></svg>
                    {t.whatsAppReceipt}
                  </button>
                )}
                <button onClick={() => handleShareReceipt(lastSale)} className="w-full bg-slate-950 dark:bg-amber-500 dark:text-slate-950 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-800 dark:hover:bg-amber-600 transition-all shadow-xl active:scale-95 text-sm md:text-base">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  {t.shareReceipt}
                </button>
                <button onClick={() => setLastSale(null)} className="w-full py-4 text-slate-400 dark:text-slate-600 font-bold hover:text-slate-600 dark:hover:text-slate-400 text-sm">{t.startNewBill}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 md:gap-4">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" placeholder={t.searchCatalog} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 md:py-3.5 pl-11 pr-4 md:pl-12 md:pr-6 outline-none focus:ring-4 focus:ring-amber-500/10 shadow-sm text-sm font-medium dark:text-slate-200" />
            </div>
            <button onClick={toggleScanner} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-amber-500 transition-all shadow-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg></button>
          </div>
          <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm self-start sm:self-auto">
            <button onClick={() => setActiveTab('services')} className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'services' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t.services}</button>
            <button onClick={() => setActiveTab('products')} className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'products' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t.products}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pr-1 scrollbar-hide pb-24 lg:pb-0">
          {filteredItems.map(item => (
            <motion.button layout key={item.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => addToCart(item, activeTab === 'services' ? 'service' : 'product')} className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between group h-32 md:h-40 relative overflow-hidden">
              <div className="relative z-10">
                <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 md:py-1 rounded-lg mb-1 md:mb-2 inline-block ${activeTab === 'services' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'}`}>
                  {activeTab === 'services' ? (item as Service).category : t.retail}
                </span>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs md:text-sm leading-tight line-clamp-2">{item.name}</h4>
              </div>
              <div className="flex items-center justify-between relative z-10">
                <p className="text-base md:text-lg font-black text-slate-900 dark:text-white">{settings.currency}{item.price}</p>
                <div className="w-7 h-7 md:w-8 md:h-8 bg-slate-900 dark:bg-slate-800 text-white rounded-full flex items-center justify-center opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {(cart.length > 0 && !showMobileCart && window.innerWidth < 1024) && (
            <motion.div 
                initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 lg:hidden z-50 flex items-center justify-between shadow-[0_-5px_20px_rgba(0,0,0,0.1)] pb-8 md:pb-6"
            >
                <div>
                   <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{cart.reduce((a, b) => a + b.quantity, 0)} {t.items}</p>
                   <p className="text-xl font-black text-slate-900 dark:text-white">{settings.currency}{totals.total.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => setShowMobileCart(true)}
                  className="bg-amber-500 text-slate-950 px-8 py-3 rounded-xl font-black uppercase text-sm shadow-lg shadow-amber-500/20"
                >
                    {t.viewCart}
                </button>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(showMobileCart || window.innerWidth >= 1024) && (
          <>
            {showMobileCart && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowMobileCart(false)}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[70] lg:hidden"
              />
            )}
            <motion.div 
              initial={window.innerWidth < 1024 ? { y: '100%' } : { x: 400 }}
              animate={window.innerWidth < 1024 ? { y: 0 } : { x: 0 }}
              exit={window.innerWidth < 1024 ? { y: '100%' } : { x: 400 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed bottom-0 left-0 right-0 lg:static lg:w-96 flex flex-col bg-white dark:bg-slate-900 rounded-t-[2.5rem] lg:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl lg:shadow-xl overflow-hidden z-[80] h-[90vh] lg:h-auto`}
            >
              <div className="p-5 md:p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
                <h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">{t.cart}</h3>
                <div className="flex gap-2">
                   {/* Held Bills Toggle */}
                   {heldSales.length > 0 && (
                      <div className="relative group">
                          <button className="bg-amber-100 text-amber-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <span>{t.held} ({heldSales.length})</span>
                          </button>
                          <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-2 hidden group-hover:block z-50">
                              <p className="px-3 py-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.selectToResume}</p>
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                  {heldSales.map(h => (
                                      <div key={h.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer">
                                          <div onClick={() => retrieveSale(h)} className="flex-1">
                                              <p className="font-bold text-xs dark:text-white">{new Date(h.timestamp).toLocaleTimeString()}</p>
                                              <p className="text-[10px] text-slate-500">{h.cart.length} {t.items}</p>
                                          </div>
                                          <button onClick={() => deleteHeldSale(h.id)} className="p-1.5 text-slate-300 hover:text-rose-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                   )}
                   <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2 text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 scrollbar-hide">
                <div>
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">{t.professional}</label>
                  <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} disabled={currentUser.role === 'employee'} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm font-bold dark:text-white disabled:opacity-50">
                    <option value="">{t.chooseProfessional}</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t.customers}</label>
                      <button onClick={() => setIsAddingCustomer(true)} className="text-[9px] md:text-[10px] font-black text-amber-600 uppercase tracking-widest hover:text-amber-500 transition-colors">{t.quickAddClient}</button>
                   </div>
                   <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-3 text-sm font-bold dark:text-white">
                     <option value="">{t.walkInClient}</option>
                     {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                   </select>
                </div>
                <div className="h-px bg-slate-50 dark:bg-slate-800 my-2"></div>
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center group py-1">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs md:text-sm leading-tight">{item.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[10px] text-slate-400 font-medium">{settings.currency}{item.price}</p>
                          {item.quantity > 1 && (
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 rounded-md">
                                  = {settings.currency}{(item.price * item.quantity).toFixed(2)}
                              </p>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-1.5 md:px-2">
                         <button onClick={() => updateQuantity(item.id, item.type, -1)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors">-</button>
                         <span className="w-6 text-center text-xs font-black dark:text-white">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.id, item.type, 1)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.type)} className="text-slate-300 hover:text-rose-500 p-1 md:opacity-0 lg:group-hover:opacity-100 transition-all">
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-center py-10 text-slate-300 italic text-sm">{t.emptyCart}</p>}
              </div>
              <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="space-y-2 text-xs font-bold text-slate-500">
                  <div className="flex justify-between">
                      <span>{t.subtotal}</span>
                      <motion.span key={totals.subtotal} className="text-slate-900 dark:text-white">
                          {settings.currency}{totals.subtotal.toFixed(2)}
                      </motion.span>
                  </div>
                  {totals.discount > 0 && <div className="flex justify-between text-emerald-500"><span>{t.discount}</span><span>-{settings.currency}{totals.discount.toFixed(2)}</span></div>}
                  <div className="flex justify-between text-xl md:text-2xl font-black text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>{t.total}</span>
                      <motion.span key={totals.total} className="text-amber-500">
                          {settings.currency}{totals.total.toFixed(2)}
                      </motion.span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())} placeholder="PROMO" className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest dark:text-white shadow-sm" />
                   <button onClick={handleHoldSale} className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">{t.holdBill}</button>
                </div>
                
                {paymentMode === 'cash' ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pb-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">{t.amountReceived}</label>
                            <input 
                                type="number" 
                                value={cashReceived} 
                                onChange={e => setCashReceived(e.target.value)} 
                                autoFocus
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-black dark:text-white focus:border-amber-500 outline-none"
                                placeholder={totals.total.toFixed(2)}
                            />
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <span className="text-xs font-bold text-slate-500">{t.change}</span>
                            <span className={`text-lg font-black ${cashChange < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {settings.currency}{cashChange.toFixed(2)}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button onClick={() => { setPaymentMode('default'); setCashReceived(''); }} className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3 rounded-xl font-bold text-xs uppercase tracking-widest">{t.cancel}</button>
                            <button onClick={() => handleCheckout('cash')} className="bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">{t.confirmPayment}</button>
                        </div>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 pb-4">
                        <button onClick={() => setPaymentMode('cash')} className="bg-emerald-500 text-white py-4 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md active:scale-95">{t.cash}</button>
                        <button onClick={() => handleCheckout('card')} className="bg-indigo-500 text-white py-4 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md active:scale-95">{t.card}</button>
                        <button onClick={() => handleCheckout('wallet')} className="bg-slate-800 text-white py-4 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md active:scale-95">{t.wallet}</button>
                    </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Scanner UI */}
      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col max-h-[85dvh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
                        {t.scanner}
                    </h3>
                    <button onClick={() => setIsScanning(false)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="bg-black relative flex-1 min-h-[250px] w-full overflow-hidden">
                    {/* Visual Glow Effect for Feedback */}
                    <AnimatePresence>
                        {scanningFeedback && (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }}
                                className={`absolute inset-0 z-10 pointer-events-none transition-colors duration-300 ${feedbackType === 'success' ? 'bg-emerald-500/10 shadow-[inset_0_0_100px_rgba(16,185,129,0.3)]' : 'bg-rose-500/20 shadow-[inset_0_0_100px_rgba(244,63,94,0.4)]'}`}
                            />
                        )}
                    </AnimatePresence>

                    <div id="reader" className="w-full h-full object-cover"></div>
                    
                    <AnimatePresence>
                        {scanningFeedback && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                                animate={{ opacity: 1, scale: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.9 }} 
                                className={`absolute bottom-6 left-6 right-6 p-4 rounded-2xl flex items-center gap-3 shadow-2xl z-20 border ${feedbackType === 'success' ? 'bg-emerald-600 border-emerald-400/50 text-white' : 'bg-rose-600 border-rose-400/50 text-white'}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${feedbackType === 'success' ? 'bg-white/20' : 'bg-white/20'}`}>
                                    {feedbackType === 'success' ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-sm">{scanningFeedback}</p>
                                    {feedbackType === 'error' && <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider mt-0.5">{t.itemNotCatalog}</p>}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="p-4 text-center bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">
                    <p>{t.alignBarcode}</p>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Add Customer Modal */}
      <AnimatePresence>
          {isAddingCustomer && (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <motion.div 
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-8 md:p-10 shadow-2xl"
                  >
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-black text-slate-900 dark:text-white">{t.quickAddClient}</h3>
                          <button onClick={() => setIsAddingCustomer(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">{t.name}</label>
                              <input 
                                  value={newCustomerData.name} 
                                  onChange={e => setNewCustomerData({...newCustomerData, name: e.target.value})}
                                  className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-amber-500/10 outline-none font-bold dark:text-white"
                                  placeholder="John Doe"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">{t.mobile}</label>
                              <div className="flex gap-2">
                                <select 
                                    onChange={(e) => replaceCountryCode(e.target.value)}
                                    className="bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-2 py-3 focus:ring-4 focus:ring-amber-500/10 outline-none font-bold dark:text-white w-16 appearance-none text-center"
                                    value=""
                                >
                                    <option value="" disabled>🌐</option>
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                                    ))}
                                </select>
                                <input 
                                    value={newCustomerData.phone} 
                                    onChange={e => setNewCustomerData({...newCustomerData, phone: e.target.value})}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-amber-500/10 outline-none font-bold dark:text-white flex-1"
                                    placeholder="+1..."
                                />
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">{t.email} ({t.optional})</label>
                              <input 
                                  value={newCustomerData.email} 
                                  onChange={e => setNewCustomerData({...newCustomerData, email: e.target.value})}
                                  className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-amber-500/10 outline-none font-bold dark:text-white"
                                  placeholder="john@example.com"
                              />
                          </div>
                          <button 
                              onClick={saveNewCustomer}
                              disabled={!newCustomerData.name}
                              className="w-full bg-amber-500 text-slate-950 py-4 rounded-2xl font-black uppercase tracking-widest mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {t.saveSelect}
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </div>
  );
};

export default POS;

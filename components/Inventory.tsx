
import React, { useState, useRef, useEffect } from 'react';
import { Service, Product, ShopSettings } from '../types';
import { TRANSLATIONS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface InventoryProps {
  services: Service[];
  products: Product[];
  settings: ShopSettings;
  onUpdateServices: (services: Service[]) => void;
  onUpdateProducts: (products: Product[]) => void;
}

const Inventory: React.FC<InventoryProps> = ({ services, products, settings, onUpdateServices, onUpdateProducts }) => {
  const [activeTab, setActiveTab] = useState<'services' | 'products'>('services');
  const [isEditing, setIsEditing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const isScannerActiveRef = useRef(false);

  const t = TRANSLATIONS[settings.language];

  useEffect(() => {
    let isMounted = true;

    const cleanupScanner = async () => {
        if (!html5QrCodeRef.current) return;
        
        try {
            if (isScannerActiveRef.current) {
                await html5QrCodeRef.current.stop();
            }
        } catch (error) {
            console.warn("Scanner stop warning:", error);
        } finally {
            isScannerActiveRef.current = false;
            try {
                await html5QrCodeRef.current.clear();
            } catch (e) {
                // Ignore clear errors
            }
            html5QrCodeRef.current = null;
        }
    };
    
    if (isScanning) {
        const startScanner = async () => {
            // Give modal animation time to finish and DOM to render
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (!isMounted || !isScanning) return;
            
            const elementId = "reader-inventory";
            if (!document.getElementById(elementId)) return;

            // Ensure previous instance is cleaned up
            await cleanupScanner();

            try {
                const html5QrCode = new Html5Qrcode(elementId, {
                  formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E
                  ],
                  verbose: false
                });
                
                html5QrCodeRef.current = html5QrCode;
                
                await html5QrCode.start(
                    { facingMode: "environment" }, 
                    { 
                        fps: 10, 
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const width = Math.floor(viewfinderWidth * 0.85);
                            const height = Math.floor(viewfinderHeight * 0.35);
                            return { width, height };
                        },
                        aspectRatio: 1.777778,
                    }, 
                    (decodedText) => {
                        if (isMounted) {
                            if (barcodeInputRef.current) barcodeInputRef.current.value = decodedText;
                            if ("vibrate" in navigator) navigator.vibrate(100);
                            setIsScanning(false); // Clean exit
                        }
                    },
                    () => {}
                );
                
                // Mark as active immediately after start returns successfully
                isScannerActiveRef.current = true;

                if (!isMounted) {
                    // Component unmounted while starting
                    await cleanupScanner();
                }
            } catch (err: any) {
                 // Differentiate permission errors from others
                 const isPermissionError = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.message?.includes('Permission');
                 
                 if (isPermissionError) {
                     console.warn("Camera permission denied");
                     if (isMounted) {
                         setIsScanning(false);
                         alert("Camera access denied. Please enable camera permissions in your browser settings.");
                     }
                 } else {
                     console.error("Inventory scanner failed to start", err);
                     if (isMounted) {
                         setIsScanning(false);
                         alert("Unable to start scanner. Please enter barcode manually.");
                     }
                 }
                 await cleanupScanner();
            }
        };
        startScanner();
    }

    return () => {
        isMounted = false;
        if (html5QrCodeRef.current) {
            // Trigger cleanup immediately on unmount
            const scanner = html5QrCodeRef.current;
            const wasActive = isScannerActiveRef.current;
            
            // If active, stop it. If not, just clear.
            if (wasActive) {
                scanner.stop().catch((e) => console.warn("Stop failed during unmount", e))
                .finally(() => {
                    try { scanner.clear(); } catch(e) {}
                    isScannerActiveRef.current = false;
                });
            } else {
                try { scanner.clear(); } catch(e) {}
            }
        }
    };
  }, [isScanning]);

  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.category.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(searchTerm)));
  const items = activeTab === 'services' ? filteredServices : filteredProducts;

  const deleteItem = (id: string, type: 'service' | 'product') => {
    if (!confirm('Permanently delete this entry?')) return;
    if (type === 'service') onUpdateServices(services.filter(s => s.id !== id));
    else onUpdateProducts(products.filter(p => p.id !== id));
  };

  const saveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const itemData = Object.fromEntries(formData.entries());
    
    if (activeTab === 'services') {
      const newService: Service = {
        id: isEditing?.id || Math.random().toString(36).substr(2, 9).toUpperCase(),
        name: itemData.name as string,
        price: parseFloat(itemData.price as string) || 0,
        duration: parseInt(itemData.duration as string) || 30,
        category: itemData.category as string,
      };
      if (isEditing.id) onUpdateServices(services.map(s => s.id === isEditing.id ? newService : s));
      else onUpdateServices([...services, newService]);
    } else {
      const newProduct: Product = {
        id: isEditing?.id || Math.random().toString(36).substr(2, 9).toUpperCase(),
        name: itemData.name as string,
        price: parseFloat(itemData.price as string) || 0,
        cost: parseFloat(itemData.cost as string) || 0,
        stock: parseInt(itemData.stock as string) || 0,
        barcode: (itemData.barcode as string) || undefined,
        lowStockThreshold: parseInt(itemData.lowStockThreshold as string) || 15
      };
      if (isEditing.id) onUpdateProducts(products.map(p => p.id === isEditing.id ? newProduct : p));
      else onUpdateProducts([...products, newProduct]);
    }
    setIsEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white font-brand">{t.shopCatalog}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.updatePrices}</p>
        </div>
        <button onClick={() => setIsEditing({})} className="bg-slate-950 dark:bg-slate-800 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg text-sm w-full sm:w-auto justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          {activeTab === 'services' ? t.newService : t.newProduct}
        </button>
      </div>
      <div className="relative">
        <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" placeholder={t.searchCatalog} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-6 outline-none focus:ring-4 focus:ring-amber-500/10 shadow-sm text-sm dark:text-slate-200" />
      </div>
      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 self-start w-full sm:w-auto">
        <button onClick={() => setActiveTab('services')} className={`flex-1 sm:px-8 py-2.5 rounded-lg font-bold transition-all text-xs md:text-sm ${activeTab === 'services' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>{t.services}</button>
        <button onClick={() => setActiveTab('products')} className={`flex-1 sm:px-8 py-2.5 rounded-lg font-bold transition-all text-xs md:text-sm ${activeTab === 'products' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>{t.inventory}</button>
      </div>
      <div className="md:hidden space-y-4">
        {items.map((item: any) => (
           <div key={item.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                 <h4 className="font-bold text-slate-800 dark:text-slate-200">{item.name}</h4>
                 <span className="text-xl font-black text-amber-500">{settings.currency}{item.price}</span>
              </div>
              <div className="flex gap-2 mt-4">
                  <button onClick={() => setIsEditing(item)} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">Edit</button>
                  <button onClick={() => deleteItem(item.id, activeTab === 'services' ? 'service' : 'product')} className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
              </div>
           </div>
        ))}
      </div>
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr><th className="px-8 py-5">Item</th><th className="px-8 py-5">Status</th><th className="px-8 py-5">Price</th><th className="px-8 py-5 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {items.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30">
                <td className="px-8 py-6 font-bold text-slate-800 dark:text-slate-200 text-sm">{item.name}</td>
                <td className="px-8 py-6 text-xs text-slate-500">{activeTab === 'services' ? item.category : `${item.stock} left`}</td>
                <td className="px-8 py-6 font-black text-slate-950 dark:text-white">{settings.currency}{item.price}</td>
                <td className="px-8 py-6 text-right space-x-2">
                  <button onClick={() => setIsEditing(item)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-amber-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                  <button onClick={() => deleteItem(item.id, activeTab === 'services' ? 'service' : 'product')} className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {items.length === 0 && (
        <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 font-bold">No items found</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try adjusting your search or add a new entry.</p>
        </div>
      )}

      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-8 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{isEditing.id ? t.editEntry : t.newEntry}</h3><button onClick={() => setIsEditing(null)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
              <form onSubmit={saveItem} className="space-y-5">
                <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Name</label>
                    <input name="name" type="text" defaultValue={isEditing.name || ''} required className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                </div>
                
                {activeTab === 'products' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Barcode</label>
                    <div className="flex gap-2">
                        <input ref={barcodeInputRef} name="barcode" type="text" defaultValue={isEditing.barcode || ''} className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                        <button type="button" onClick={() => setIsScanning(true)} className="bg-slate-900 text-white p-3.5 rounded-2xl hover:bg-slate-800 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
                        </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Price</label>
                    <input name="price" type="number" step="0.01" defaultValue={isEditing.price || ''} required className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                  </div>
                  {activeTab === 'products' ? (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Cost</label>
                        <input name="cost" type="number" step="0.01" defaultValue={isEditing.cost || ''} className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                      </div>
                  ) : (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Mins</label>
                        <input name="duration" type="number" defaultValue={isEditing.duration || 30} className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                      </div>
                  )}
                </div>

                {activeTab === 'products' ? (
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Stock</label>
                        <input name="stock" type="number" defaultValue={isEditing.stock || 0} className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Low Stock Alert</label>
                        <input name="lowStockThreshold" type="number" defaultValue={isEditing.lowStockThreshold || 15} className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                      </div>
                  </div>
                ) : (
                   <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2 ml-1">Category</label>
                    <input name="category" type="text" defaultValue={isEditing.category || ''} required className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 focus:ring-4 focus:ring-amber-500/10 outline-none text-sm font-bold dark:text-slate-200" />
                   </div>
                )}
                
                <button type="submit" className="w-full py-4 bg-amber-500 text-slate-950 rounded-2xl font-black text-base shadow-xl mt-4">Save Changes</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isScanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col max-h-[85dvh]">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <h3 className="font-black text-slate-900 dark:text-white text-lg flex items-center gap-2">Scanner</h3>
                    <button onClick={() => setIsScanning(false)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-rose-500 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="bg-black relative flex-1 min-h-[250px] w-full overflow-hidden">
                    <div id="reader-inventory" className="w-full h-full object-cover"></div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;

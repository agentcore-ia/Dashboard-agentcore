"use client";

import { useState, useEffect } from "react";

interface Product {
  id: string;
  restaurant_id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
  aliases?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const CATEGORY_MAP: Record<string, { icon: string; colorClass: string }> = {
  Pizzas: { icon: "local_pizza", colorClass: "bg-orange-100 text-orange-800" },
  Burgers: { icon: "lunch_dining", colorClass: "bg-stone-100 text-stone-500" },
  Bebidas: { icon: "local_bar", colorClass: "bg-lime-50 text-lime-700" },
  Postres: { icon: "icecream", colorClass: "bg-pink-50 text-pink-700" },
  Pasta: { icon: "dinner_dining", colorClass: "bg-stone-100 text-stone-500" },
  default: { icon: "restaurant", colorClass: "bg-green-50 text-green-700" },
};

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001';

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Todo");
  const [search, setSearch] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
     name: "", description: "", price: 0, category: "Pizzas", available: true, aliases: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/menu`);
      if (res.ok) {
        const rawData = await res.json();
        // The backend returns keys matching the spreadsheet: producto, tipo, disponible, precio, ingredientes, aliases
        const mappedData = rawData.map((item: any, idx: number) => ({
           id: `gsheet-${idx}`,
           name: item.producto,
           category: item.tipo,
           available: item.disponible === 'Sí',
           price: parseFloat(String(item.precio).replace(/[^0-9.]/g, '')),
           description: item.ingredientes || '',
           aliases: item.aliases || ''
        }));
        setProducts(mappedData);
      } else {
        console.error('API Error:', await res.text());
      }
    } catch (error) {
       console.error('Fetch error:', error);
    }
    setLoading(false);
  }

  const toggleAvailability = async (product: Product) => {
    const newStatus = !product.available;
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, available: newStatus } : p));
    
    try {
       const res = await fetch(`${API_URL}/menu/${encodeURIComponent(product.name)}/disponible`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disponible: newStatus ? 'Sí' : 'No' })
       });
       if (!res.ok) throw new Error("Sync failed");
    } catch (err) {
       console.error('Error toggling availability:', err);
       setProducts(prev => prev.map(p => p.id === product.id ? { ...p, available: product.available } : p));
    }
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setFormData({ name: "", description: "", price: 0, category: "Pizzas", available: true, aliases: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      available: product.available,
      aliases: product.aliases || ""
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const payload = {
        producto: formData.name,
        ingredientes: formData.description,
        precio: Number(formData.price),
        tipo: formData.category,
        disponible: formData.available ? "Sí" : "No",
        aliases: formData.aliases
      };

      let res;
      if (editingProduct) {
         res = await fetch(`${API_URL}/menu/${encodeURIComponent(editingProduct.name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         });
      } else {
         res = await fetch(`${API_URL}/menu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         });
      }
      
      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.error || "API Save Error");
      }
      
      const { data: savedData } = await res.json();
      
      const mappedRecord: Product = {
         id: editingProduct ? editingProduct.id : `gsheet-new-${Date.now()}`,
         name: savedData.Producto || formData.name || "",
         category: savedData.Tipo || formData.category || "Otro",
         available: (savedData.Disponible === 'Sí' || (formData.available ?? false)),
         price: Number(formData.price),
         description: savedData.Ingredientes || formData.description || "",
         aliases: savedData.Aliases || formData.aliases || ""
      };
      
      if (editingProduct) {
         setProducts(prev => prev.map(p => p.id === editingProduct.id ? mappedRecord : p));
      } else {
         setProducts(prev => [...prev, mappedRecord]);
      }
    } catch (error: any) {
       console.error("Save error:", error);
       alert("Error al guardar el producto: " + error.message);
    }
    
    setIsSaving(false);
    closeModal();
  };

  const deleteProduct = async () => {
    if (!editingProduct) return;
    if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
    
    setIsSaving(true);
    try {
       const res = await fetch(`${API_URL}/menu/${encodeURIComponent(editingProduct.name)}`, {
          method: 'DELETE'
       });
       if (res.ok) {
          setProducts(prev => prev.filter(p => p.id !== editingProduct.id));
       } else {
          throw new Error("API Delete Error");
       }
    } catch (err) {
       console.error("Delete error:", err);
       alert("Error al eliminar el producto.");
    }
    setIsSaving(false);
    closeModal();
  };

  const categories = ["Todo", "Pizzas", "Burgers", "Bebidas", "Postres", "Pasta"];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.description?.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeFilter === "Todo" || p.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-12 pt-6 lg:pt-8 bg-surface w-full">
      {/* Search Bar / Top Mobile Nav space placeholder if needed, matching code.html struct */}
      <div className="flex justify-end mb-6 w-full lg:hidden">
         <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-stone-400">search</span>
            <input 
               className="w-full pl-10 pr-4 py-3 bg-surface-container-high border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all focus:bg-surface-container-lowest" 
               placeholder="Buscar platos..." 
               type="text"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
            />
         </div>
      </div>

      {/* Header Section */}
      <div className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-headline">Categorías del Menú</h1>
          <p className="text-stone-500 text-sm mt-1">Gestiona los platos y su disponibilidad</p>
        </div>
        <div className="hidden lg:block relative group w-64 mr-4">
           {/* Desktop search */}
           <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-stone-400">search</span>
           <input 
              className="w-full pl-10 pr-4 py-3 bg-surface-container-high border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all focus:bg-surface-container-lowest" 
              placeholder="Buscar platos..." 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
           />
        </div>
        <button 
           onClick={openNewModal}
           className="h-12 px-6 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:translate-y-0"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          <span>Añadir Nuevo Plato</span>
        </button>
      </div>

      {/* Compact Category Filter */}
      <div className="mb-10 flex flex-wrap gap-3 items-center">
        {categories.map((cat) => {
          const isActive = activeFilter === cat;
          const catInfo = CATEGORY_MAP[cat] || CATEGORY_MAP.default;
          // Icon for "Todo" is list
          const icon = cat === "Todo" ? "list" : catInfo.icon;
          
          return (
            <button 
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
                 isActive 
                   ? "bg-primary text-on-primary shadow-md shadow-primary/20 font-bold" 
                   : "bg-surface-container-low text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{icon}</span>
              <span className="hidden sm:inline">{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Menu List */}
      {loading ? (
         <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-b-2 border-primary rounded-full"></div></div>
      ) : filteredProducts.length === 0 ? (
         <div className="text-center p-20 text-stone-400 bg-surface-container-lowest rounded-3xl border border-dashed border-stone-200">No se encontraron productos.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const catInfo = CATEGORY_MAP[product.category] || CATEGORY_MAP.default;
            
            return (
              <div 
                 key={product.id} 
                 className={`bg-surface-container-lowest rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm border border-stone-100 hover:border-primary/20 transition-all group ${!product.available ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0 mb-4 sm:mb-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${product.available ? catInfo.colorClass : 'bg-stone-100 text-stone-400'}`}>
                    <span className="material-symbols-outlined">{catInfo.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-on-surface truncate font-headline">{product.name}</h3>
                      <span className={`text-sm font-black ${product.available ? 'text-primary' : 'text-stone-400'}`}>${Number(product.price).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-stone-500 truncate mt-0.5">{product.description || "Sin descripción"}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end sm:justify-start gap-6 sm:pl-4 sm:border-l sm:border-stone-100">
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                         type="checkbox" 
                         className="sr-only toggle-checkbox" 
                         checked={product.available}
                         onChange={() => toggleAvailability(product)}
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${product.available ? 'bg-primary' : 'bg-stone-200'}`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${product.available ? 'translate-x-[1rem]' : ''}`}></div>
                      </div>
                    </label>
                    <span className={`text-[10px] font-bold uppercase hidden sm:inline ${product.available ? 'text-primary' : 'text-stone-400'}`}>
                       {product.available ? 'Disponible' : 'Agotado'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button 
                       onClick={() => openEditModal(product)}
                       className="p-1.5 text-stone-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-surface-container-low/30">
              <h2 className="text-xl font-headline font-black text-on-surface">
                 {editingProduct ? 'Editar Plato' : 'Añadir Nuevo Plato'}
              </h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-200 text-stone-500 transition-colors">
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>
            
            <form onSubmit={saveProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Nombre del Plato</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Ej. Pizza Margarita"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Precio ($)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Categoría</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                  >
                    {categories.filter(c => c !== "Todo").map(cat => (
                       <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Descripción o Ingredientes</label>
                <textarea 
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                  placeholder="Ej: Salsa de tomate, muzzarella, orégano..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Aliases (Separados por coma)</label>
                <input 
                  type="text" 
                  value={formData.aliases}
                  onChange={e => setFormData({...formData, aliases: e.target.value})}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Ej: muzza, muzarella, pizza especial"
                />
                <p className="text-[10px] text-stone-400 mt-1 ml-1 leading-tight">Palabras clave que ayudarán a la IA a identificar cuando un cliente pide este producto.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                       type="checkbox" 
                       className="sr-only toggle-checkbox" 
                       checked={formData.available}
                       onChange={e => setFormData({...formData, available: e.target.checked})}
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${formData.available ? 'bg-primary' : 'bg-stone-200'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform shadow-sm ${formData.available ? 'translate-x-[1.25rem]' : ''}`}></div>
                    </div>
                  </label>
                  <span className="text-sm font-bold text-stone-700">Producto Disponible al Público</span>
              </div>

              <div className="pt-6 flex items-center justify-between border-t border-stone-100 mt-6">
                {editingProduct ? (
                  <button 
                     type="button"
                     onClick={deleteProduct}
                     className="text-error hover:bg-error/10 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                    Eliminar
                  </button>
                ) : <div></div>}
                
                <div className="flex gap-3">
                  <button 
                     type="button" 
                     onClick={closeModal}
                     className="px-5 py-2.5 rounded-xl font-bold text-sm text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                     type="submit"
                     disabled={isSaving}
                     className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                    {editingProduct ? 'Guardar Cambios' : 'Crear Plato'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

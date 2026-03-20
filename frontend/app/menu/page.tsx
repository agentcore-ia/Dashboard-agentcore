"use client";

import { useState } from "react";
import { 
  UtensilsCrossed, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  AlertCircle
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  in_stock: boolean;
  stock_quantity?: number;
}

const DEMO_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Beast Classic",
    description: "Hamburguesa de 180g, queso cheddar, lechuga, tomate y salsa especial.",
    price: 32.90,
    category: "Hamburguesas",
    in_stock: true,
    stock_quantity: 45
  },
  {
    id: "2",
    name: "Beast Double",
    description: "Doble carne de 180g, doble cheddar, bacon crujiente y cebolla caramelizada.",
    price: 44.90,
    category: "Hamburguesas",
    in_stock: true,
    stock_quantity: 20
  },
  {
    id: "3",
    name: "Papas con Cheddar y Bacon",
    description: "Porción de papas fritas crocantes con baño de cheddar y trozos de bacon.",
    price: 22.90,
    category: "Acompañamientos",
    in_stock: true,
    stock_quantity: 100
  },
  {
    id: "4",
    name: "Refresco 600ml",
    description: "Coca-Cola, Sprite o Fanta bien fría.",
    price: 9.00,
    category: "Bebidas",
    in_stock: false,
    stock_quantity: 0
  }
];

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [search, setSearch] = useState("");

  const toggleStock = (id: string) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, in_stock: !p.in_stock } : p
    ));
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center icon-orange">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl lg:text-2xl">Menú y Stock</h1>
            <p className="text-xs lg:text-sm text-white/40">Gestiona tus productos y disponibilidad en tiempo real</p>
          </div>
        </div>
        <button className="btn-primary flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input 
            type="text"
            placeholder="Buscar por nombre o categoría..."
            className="input-dark pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-ghost flex items-center justify-center gap-2">
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
        </button>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProducts.map((p) => (
          <div key={p.id} className="glass-card p-5 group flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] uppercase tracking-wider font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                {p.category}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-1.5 hover:bg-red-500/10 rounded-lg text-white/50 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{p.name}</h3>
              <p className="text-xs text-white/50 line-clamp-2 mb-4 leading-relaxed">
                {p.description}
              </p>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
              <span className="font-bold text-xl text-green-400">
                ${p.price.toFixed(2)}
              </span>
              
              <button 
                onClick={() => toggleStock(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  p.in_stock 
                    ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" 
                    : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                }`}
              >
                {p.in_stock ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> En Stock</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /> Agotado</>
                )}
              </button>
            </div>

            {!p.in_stock && (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-red-400/80 bg-red-400/5 p-2 rounded-lg">
                <AlertCircle className="w-3 h-3" />
                <span>La IA no ofrecerá este producto hasta que haya stock</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="text-xl font-bold mb-1">No se encontraron productos</h3>
          <p className="text-white/40 max-w-xs">Prueba con términos diferentes o agrega un producto nuevo.</p>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";

export interface OrderItem { id: string; product_id: string; name: string; price: number; quantity: number; note?: string; }
interface Prod { id: string; name: string; category: string; price: number; }
interface TableInfo { id: string; name: string; status: "free"|"occupied"|"reserved"; current_client?: string|null; time_elapsed?: string|null; current_bill?: number|null; current_order_items?: OrderItem[]|null; }
interface Props { table: TableInfo; products: Prod[]; initialCategory?: string|null; onClose: () => void; onCobrar: () => void; onSave: (items: OrderItem[], bill: number) => void; }

const MK = "pos_mu";
const getMU = (): Record<string,number> => { try { return JSON.parse(localStorage.getItem(MK)||"{}"); } catch { return {}; } };
const trackMU = (id: string) => { const m=getMU(); m[id]=(m[id]||0)+1; localStorage.setItem(MK,JSON.stringify(m)); };
const fmt = (n: number) => "$"+n.toLocaleString("es-AR");

export default function POSDrawer({ table, products, initialCategory, onClose, onCobrar, onSave }: Props) {
  const [items, setItems] = useState<OrderItem[]>(table.current_order_items || []);
  const [cat, setCat] = useState<string|null>(initialCategory||null);
  const [search, setSearch] = useState("");
  const [flashId, setFlashId] = useState<string|null>(null);
  const [editQty, setEditQty] = useState<{id:string;val:string}|null>(null);
  const [editNote, setEditNote] = useState<{id:string;val:string}|null>(null);
  const [undo, setUndo] = useState<OrderItem[]|null>(null);
  const [lastProd, setLastProd] = useState<Prod|null>(null);
  const [mu] = useState(getMU);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const cats = Array.from(new Set(products.map(p=>p.category).filter(Boolean)));
  const sorted = [...products].sort((a,b)=>(mu[b.id]||0)-(mu[a.id]||0));
  const filtered = sorted.filter(p=>(!cat||p.category===cat)&&(!search||p.name.toLowerCase().includes(search.toLowerCase())));
  const total = items.reduce((s,i)=>s+i.price*i.quantity,0);
  const count = items.reduce((s,i)=>s+i.quantity,0);

  const commit = (it: OrderItem[]) => { setItems(it); onSave(it, it.reduce((s,i)=>s+i.price*i.quantity,0)); };

  const add = (p: Prod) => {
    setUndo(items); setLastProd(p); trackMU(p.id);
    setFlashId(p.id); setTimeout(()=>setFlashId(null),120);
    const idx=items.findIndex(i=>i.product_id===p.id);
    commit(idx>=0 ? items.map((i,n)=>n===idx?{...i,quantity:i.quantity+1}:i) : [...items,{id:Math.random().toString(36).slice(2),product_id:p.id,name:p.name,price:p.price,quantity:1}]);
    setTimeout(()=>{ if(listRef.current) listRef.current.scrollTop=listRef.current.scrollHeight; },20);
  };

  const chQty = (id:string,d:number) => { setUndo(items); commit(items.map(i=>i.id===id?{...i,quantity:Math.max(1,i.quantity+d)}:i)); };
  const setQty = (id:string,q:number) => { if(q<1)return; commit(items.map(i=>i.id===id?{...i,quantity:q}:i)); };
  const rm = (id:string) => { setUndo(items); commit(items.filter(i=>i.id!==id)); };
  const setNote = (id:string,note:string) => commit(items.map(i=>i.id===id?{...i,note}:i));
  const doUndo = () => { if(!undo)return; commit(undo); setUndo(null); };
  const clear = () => { if(!window.confirm(`¿Limpiar cuenta de ${table.name}?`))return; setUndo(items); commit([]); };

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      const t=(e.target as HTMLElement).tagName;
      if(t==="INPUT"||t==="TEXTAREA")return;
      if(e.key==="Escape") onClose();
      if(e.key==="Enter"&&items.length>0) onCobrar();
      if(e.key==="f"||e.key==="F"){e.preventDefault();searchRef.current?.focus();}
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();doUndo();}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[items,undo]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col lg:flex-row bg-stone-100">

      {/* LEFT: CATALOG */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-stone-100">

        {/* topbar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-stone-200 shrink-0 shadow-sm">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 active:scale-90 transition-all shrink-0 border border-stone-200">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col leading-none shrink-0">
            <span className="font-black text-stone-800 text-base">{table.name}</span>
            {table.time_elapsed && <span className="text-[11px] text-stone-400 font-medium mt-0.5">{table.time_elapsed}</span>}
          </div>
          <div className="flex-1 flex items-center gap-2 bg-stone-100 border border-stone-200 rounded-xl px-3 h-10">
            <span className="material-symbols-outlined text-stone-400 text-[18px]">search</span>
            <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar… (F)" className="flex-1 bg-transparent text-stone-700 text-sm outline-none placeholder:text-stone-400"/>
            {search && <button onClick={()=>setSearch("")}><span className="material-symbols-outlined text-stone-400 text-[16px]">close</span></button>}
          </div>
          {count>0 && (
            <span className="bg-red-700 text-white font-black text-xs px-3 py-1.5 rounded-lg shrink-0 shadow-sm">
              {count} ítem{count!==1?"s":""}
            </span>
          )}
        </div>

        {/* categories */}
        <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-stone-200 overflow-x-auto shrink-0 hide-scroll">
          <button onClick={()=>setCat(null)}
            className={`shrink-0 h-9 px-4 rounded-full font-black text-xs uppercase tracking-wider transition-all duration-75 active:scale-90 ${!cat?"bg-red-700 text-white shadow-md shadow-red-900/20":"bg-stone-100 text-stone-500 hover:bg-stone-200 border border-stone-200"}`}>
            Todas
          </button>
          {cats.map(c=>(
            <button key={c} onClick={()=>setCat(cat===c?null:c)}
              className={`shrink-0 h-9 px-4 rounded-full font-black text-xs uppercase tracking-wider transition-all duration-75 active:scale-90 ${cat===c?"bg-red-700 text-white shadow-md shadow-red-900/20":"bg-stone-100 text-stone-500 hover:bg-stone-200 border border-stone-200"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* quick actions */}
        {(lastProd||undo) && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            {lastProd && (
              <button onClick={()=>add(lastProd)} className="flex items-center gap-1.5 h-8 px-3 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[14px]">replay</span>
                Repetir: {lastProd.name}
              </button>
            )}
            {undo && (
              <button onClick={doUndo} className="flex items-center gap-1.5 h-8 px-3 bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 rounded-lg text-xs font-bold active:scale-95 transition-all">
                <span className="material-symbols-outlined text-[14px]">undo</span>
                Deshacer
              </button>
            )}
          </div>
        )}

        {/* product grid */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {filtered.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <span className="material-symbols-outlined text-[40px] mb-2">search_off</span>
              <span className="font-bold text-sm">Sin resultados</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filtered.map(p=>{
                const inCart=items.find(i=>i.product_id===p.id);
                const flash=flashId===p.id;
                return (
                  <button key={p.id} onClick={()=>add(p)}
                    className={`relative flex flex-col justify-between text-left rounded-2xl p-3 transition-all duration-75 active:scale-[0.88] select-none border-2 focus:outline-none shadow-sm
                      ${flash?"bg-red-700 border-red-600 scale-[0.95] shadow-lg shadow-red-900/20":inCart?"bg-white border-red-300 shadow-md":"bg-white border-stone-200 hover:border-stone-300 hover:shadow-md"}`}
                    style={{minHeight:"76px"}}>
                    {inCart && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-700 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-md z-10 border-2 border-stone-100">
                        {inCart.quantity}
                      </div>
                    )}
                    {(mu[p.id]||0)>2&&!inCart && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400"/>}
                    <span className={`font-bold text-[12px] leading-tight line-clamp-2 ${flash?"text-white":"text-stone-700"}`}>{p.name}</span>
                    <span className={`font-black text-sm mt-1 ${flash?"text-red-100":"text-red-700"}`}>{fmt(p.price||0)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: COMANDA */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white border-l border-stone-200 shrink-0 max-h-[48vh] lg:max-h-full shadow-xl">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-black text-stone-800 text-base">Comanda</span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${items.length>0?"bg-red-100 text-red-700":"bg-stone-100 text-stone-400"}`}>
              {items.length>0?"En curso":"Vacía"}
            </span>
          </div>
          {items.length>0 && (
            <button onClick={clear} className="text-stone-400 hover:text-red-600 text-xs flex items-center gap-1 transition-colors font-bold">
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              Limpiar
            </button>
          )}
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 flex flex-col gap-2">
          {items.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-300 select-none py-8">
              <span className="material-symbols-outlined text-[52px] mb-3">receipt_long</span>
              <span className="font-bold text-sm text-stone-400">Comanda vacía</span>
              <span className="text-xs text-stone-300 mt-1">Tocá un producto para agregar</span>
            </div>
          ) : items.map((item,idx)=>{
            const isLast=idx===items.length-1;
            return (
              <div key={item.id} className={`rounded-2xl p-3 transition-all border-2 ${isLast?"border-red-200 bg-red-50/50 shadow-sm":"border-stone-100 bg-stone-50/50"}`}>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button onClick={()=>chQty(item.id,1)} className="w-9 h-8 rounded-xl bg-red-700 hover:bg-red-800 active:scale-95 flex items-center justify-center text-white transition-all shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                    {editQty?.id===item.id ? (
                      <input autoFocus type="number" onFocus={e=>e.target.select()} value={editQty.val}
                        onChange={e=>setEditQty({id:item.id,val:e.target.value})}
                        onBlur={()=>{setQty(item.id,parseInt(editQty.val)||1);setEditQty(null);}}
                        onKeyDown={e=>{if(e.key==="Enter"){setQty(item.id,parseInt(editQty.val)||1);setEditQty(null);}if(e.key==="Escape")setEditQty(null);}}
                        className="w-9 h-7 text-center bg-white text-red-700 text-sm font-black rounded-lg outline-none focus:ring-2 focus:ring-red-300 border border-stone-200"/>
                    ) : (
                      <button onClick={()=>setEditQty({id:item.id,val:String(item.quantity)})} className="w-9 h-7 text-center font-black text-stone-700 text-[15px] hover:text-red-700 transition-colors">
                        {item.quantity}
                      </button>
                    )}
                    <button onClick={()=>chQty(item.id,-1)} className="w-9 h-8 rounded-xl bg-stone-200 hover:bg-stone-300 active:scale-95 flex items-center justify-center text-stone-600 transition-all">
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 px-2 flex flex-col justify-center">
                    <p className={`font-bold text-sm leading-tight truncate ${isLast?"text-stone-800":"text-stone-700"}`}>{item.name}</p>
                    <span className="font-black text-red-700 text-[13px] mt-0.5">{fmt(item.price||0)} <span className="opacity-50 text-[10px] font-bold">c/u</span></span>
                    {editNote?.id===item.id ? (
                      <input autoFocus type="text" value={editNote.val} maxLength={60}
                        onChange={e=>setEditNote({id:item.id,val:e.target.value})}
                        onBlur={()=>{setNote(item.id,editNote.val);setEditNote(null);}}
                        onKeyDown={e=>{if(e.key==="Enter"){setNote(item.id,editNote.val);setEditNote(null);}if(e.key==="Escape")setEditNote(null);}}
                        placeholder="Sin cebolla..."
                        className="mt-2 w-full bg-amber-50 text-amber-700 text-xs px-2 py-1.5 rounded-lg outline-none border border-amber-200 placeholder:text-amber-300"/>
                    ) : (
                      <button onClick={()=>setEditNote({id:item.id,val:item.note||""})} className={`mt-1.5 text-left text-xs font-semibold truncate transition-colors w-full rounded-lg p-1 -ml-1 ${item.note?'text-amber-600 bg-amber-50 hover:bg-amber-100':'text-stone-400 hover:text-stone-500 hover:bg-stone-100'}`}>
                        {item.note ? `📝 ${item.note}` : "+ Agregar nota"}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button onClick={()=>rm(item.id)} className="w-8 h-8 rounded-xl bg-stone-100 text-stone-400 hover:text-red-600 hover:bg-red-50 active:scale-90 flex items-center justify-center transition-all border border-stone-200">
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                    <span className="font-black text-stone-800 text-base mt-auto">{fmt((item.price||0)*item.quantity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom bar */}
        <div className="border-t border-stone-200 p-4 bg-white shrink-0">
          <div className="flex justify-between items-end mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-0.5">TOTAL COMANDA</span>
              <span className="text-sm font-bold text-stone-400">{count} ítem{count!==1?"s":""}</span>
            </div>
            <span className="text-[38px] leading-none font-black text-stone-800 tracking-tighter">{fmt(total)}</span>
          </div>

          <button onClick={onCobrar} disabled={items.length===0}
            className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 transition-all duration-75 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg shadow-emerald-900/20 mb-2.5">
            <span className="material-symbols-outlined text-[22px]">send</span>
            MANDAR PEDIDO
            <kbd className="text-xs font-bold opacity-60 border-2 border-white/20 px-1.5 py-0.5 rounded-md ml-1">ENTER</kbd>
          </button>

          <button onClick={onClose}
            className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all duration-75 active:scale-[0.97] bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 mb-3">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            CERRAR
          </button>

          <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-stone-400">
            <span className="flex items-center gap-1"><kbd className="border border-stone-200 px-1 rounded text-stone-400 bg-stone-50">ESC</kbd> Volver</span>
            <span className="flex items-center gap-1"><kbd className="border border-stone-200 px-1 rounded text-stone-400 bg-stone-50">F</kbd> Buscar</span>
            <span className="flex items-center gap-1"><kbd className="border border-stone-200 px-1 rounded text-stone-400 bg-stone-50">Ctrl+Z</kbd> Deshacer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

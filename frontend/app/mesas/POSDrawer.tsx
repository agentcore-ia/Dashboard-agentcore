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
    setFlashId(p.id); setTimeout(()=>setFlashId(null),250);
    const idx=items.findIndex(i=>i.product_id===p.id);
    commit(idx>=0 ? items.map((i,n)=>n===idx?{...i,quantity:i.quantity+1}:i) : [...items,{id:Math.random().toString(36).slice(2),product_id:p.id,name:p.name,price:p.price,quantity:1}]);
    setTimeout(()=>{ if(listRef.current) listRef.current.scrollTop=listRef.current.scrollHeight; },50);
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

  const Btn = ({label,onClick,cls}:{label:string;onClick:()=>void;cls?:string}) => (
    <button onClick={onClick} className={`shrink-0 h-8 px-3 rounded-lg font-bold text-xs transition-all active:scale-95 ${cls}`}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col lg:flex-row bg-stone-950">

      {/* ── LEFT: CATALOG ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* topbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-stone-900 border-b border-stone-800 shrink-0">
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 active:scale-90 transition-all shrink-0">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col leading-none shrink-0">
            <span className="font-black text-white text-base">{table.name}</span>
            {table.time_elapsed && <span className="text-[11px] text-stone-500">{table.time_elapsed}</span>}
          </div>
          <div className="flex-1 flex items-center gap-1.5 bg-stone-800 rounded-lg px-3 h-9">
            <span className="material-symbols-outlined text-stone-500 text-[16px]">search</span>
            <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar… (F)" className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-stone-600"/>
            {search && <button onClick={()=>setSearch("")}><span className="material-symbols-outlined text-stone-500 text-[14px]">close</span></button>}
          </div>
          {count>0 && <span className="bg-emerald-700 text-white font-black text-xs px-2.5 py-1.5 rounded-lg shrink-0">{count} ítem{count!==1?"s":""}</span>}
        </div>

        {/* categories */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 border-b border-stone-800 overflow-x-auto shrink-0 hide-scroll">
          <Btn label="Todo" onClick={()=>setCat(null)} cls={!cat?"bg-white text-stone-900":"bg-stone-800 text-stone-400 hover:bg-stone-700"}/>
          {cats.map(c=><Btn key={c} label={c} onClick={()=>setCat(cat===c?null:c)} cls={cat===c?"bg-white text-stone-900":"bg-stone-800 text-stone-400 hover:bg-stone-700"}/>)}
        </div>

        {/* quick actions */}
        {(lastProd||undo) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-900 border-b border-stone-800 shrink-0">
            {lastProd && <button onClick={()=>add(lastProd)} className="flex items-center gap-1 h-7 px-2.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"><span className="material-symbols-outlined text-[13px]">replay</span>Repetir: {lastProd.name}</button>}
            {undo && <button onClick={doUndo} className="flex items-center gap-1 h-7 px-2.5 bg-stone-700 hover:bg-stone-600 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"><span className="material-symbols-outlined text-[13px]">undo</span>Deshacer</button>}
          </div>
        )}

        {/* product grid */}
        <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar">
          {filtered.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-700"><span className="material-symbols-outlined text-[40px] mb-2">search_off</span><span className="font-bold text-sm">Sin resultados</span></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
              {filtered.map(p=>{
                const inCart=items.find(i=>i.product_id===p.id);
                const flash=flashId===p.id;
                return (
                  <button key={p.id} onClick={()=>add(p)}
                    className={`relative flex flex-col justify-between text-left rounded-xl p-2.5 transition-all duration-100 active:scale-[0.90] select-none border-2 focus:outline-none
                      ${flash?"bg-emerald-600 border-emerald-400 scale-[0.94]":inCart?"bg-stone-800 border-stone-600 hover:border-stone-500":"bg-stone-900 border-stone-800 hover:border-stone-600 hover:bg-stone-800"}`}
                    style={{minHeight:"76px"}}>
                    {inCart && <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow z-10">{inCart.quantity}</div>}
                    {(mu[p.id]||0)>2&&!inCart && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400"/>}
                    <span className={`font-semibold text-xs leading-snug line-clamp-2 ${flash?"text-white":"text-stone-200"}`}>{p.name}</span>
                    <span className={`font-black text-sm mt-1 ${flash?"text-emerald-100":"text-emerald-400"}`}>{fmt(p.price||0)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: COMANDA ── */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-stone-900 border-l border-stone-800 shrink-0 max-h-[48vh] lg:max-h-full">

        <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-800 shrink-0">
          <div>
            <span className="font-black text-white">Comanda</span>
            <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${items.length>0?"bg-emerald-900 text-emerald-400":"bg-stone-800 text-stone-600"}`}>
              {items.length>0?"En curso":"Vacía"}
            </span>
          </div>
          {items.length>0 && <button onClick={clear} className="text-stone-700 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"><span className="material-symbols-outlined text-[13px]">delete_sweep</span>Limpiar</button>}
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 flex flex-col gap-1.5">
          {items.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-700 select-none py-6">
              <span className="material-symbols-outlined text-[48px] mb-2">receipt_long</span>
              <span className="font-bold text-sm">Cuenta vacía</span>
              <span className="text-xs text-stone-600 mt-1">Tocá un producto para agregar</span>
            </div>
          ) : items.map((item,idx)=>{
            const isLast=idx===items.length-1;
            return (
              <div key={item.id} className={`rounded-xl p-2.5 ${isLast?"ring-1 ring-emerald-600 bg-stone-800":"bg-stone-800/50"}`}>
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>chQty(item.id,-1)} className="w-7 h-7 rounded-lg bg-stone-700 hover:bg-stone-600 active:scale-90 flex items-center justify-center text-white transition-all shrink-0">
                    <span className="material-symbols-outlined text-[15px]">remove</span>
                  </button>
                  {editQty?.id===item.id ? (
                    <input autoFocus type="number" value={editQty.val}
                      onChange={e=>setEditQty({id:item.id,val:e.target.value})}
                      onBlur={()=>{setQty(item.id,parseInt(editQty.val)||1);setEditQty(null);}}
                      onKeyDown={e=>{if(e.key==="Enter"){setQty(item.id,parseInt(editQty.val)||1);setEditQty(null);}if(e.key==="Escape")setEditQty(null);}}
                      className="w-10 h-7 text-center bg-stone-700 text-white text-sm font-black rounded-lg outline-none border border-emerald-500 shrink-0"/>
                  ) : (
                    <button onClick={()=>setEditQty({id:item.id,val:String(item.quantity)})} className="w-8 text-center font-black text-white text-sm hover:text-emerald-400 shrink-0 transition-colors">
                      {item.quantity}
                    </button>
                  )}
                  <button onClick={()=>chQty(item.id,1)} className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:scale-90 flex items-center justify-center text-white transition-all shrink-0">
                    <span className="material-symbols-outlined text-[15px]">add</span>
                  </button>
                  <div className="flex-1 min-w-0 mx-1">
                    <p className="font-semibold text-stone-200 text-xs leading-tight truncate">{item.name}</p>
                    {item.note && <p className="text-[10px] text-amber-400 truncate">📝 {item.note}</p>}
                  </div>
                  <span className="font-black text-white text-sm shrink-0">{fmt((item.price||0)*item.quantity)}</span>
                  <button onClick={()=>rm(item.id)} className="w-7 h-7 rounded-lg text-stone-700 hover:text-red-400 hover:bg-red-900/20 active:scale-90 flex items-center justify-center transition-all shrink-0">
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
                {editNote?.id===item.id ? (
                  <input autoFocus type="text" value={editNote.val} maxLength={60}
                    onChange={e=>setEditNote({id:item.id,val:e.target.value})}
                    onBlur={()=>{setNote(item.id,editNote.val);setEditNote(null);}}
                    onKeyDown={e=>{if(e.key==="Enter"){setNote(item.id,editNote.val);setEditNote(null);}if(e.key==="Escape")setEditNote(null);}}
                    placeholder="Sin cebolla, bien cocido…"
                    className="mt-1.5 w-full bg-stone-700 text-stone-200 text-xs px-2 py-1.5 rounded-lg outline-none border border-amber-600/50 placeholder:text-stone-600"/>
                ) : (
                  <button onClick={()=>setEditNote({id:item.id,val:item.note||""})} className="mt-1 text-left text-[11px] text-stone-700 hover:text-amber-400 transition-colors w-full truncate">
                    {item.note ? `📝 ${item.note}` : "＋ nota"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* sticky bottom */}
        <div className="border-t border-stone-800 p-3 shrink-0">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-stone-500">TOTAL · {count} ítem{count!==1?"s":""}</span>
            <span className="text-4xl font-black text-white tracking-tight">{fmt(total)}</span>
          </div>
          <button onClick={onCobrar} disabled={items.length===0}
            className="w-full h-14 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg mb-2">
            <span className="material-symbols-outlined text-2xl">payments</span>
            Cobrar
            <kbd className="text-xs font-normal opacity-50 border border-white/20 px-1 rounded">Enter</kbd>
          </button>
          <div className="text-center text-[10px] text-stone-700">
            <kbd className="border border-stone-800 px-1 rounded">Esc</kbd> cerrar &nbsp;·&nbsp;
            <kbd className="border border-stone-800 px-1 rounded">F</kbd> buscar &nbsp;·&nbsp;
            <kbd className="border border-stone-800 px-1 rounded">Ctrl+Z</kbd> deshacer
          </div>
        </div>
      </div>
    </div>
  );
}

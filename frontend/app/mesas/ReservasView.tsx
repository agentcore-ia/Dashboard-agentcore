"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Table } from "./PlanoView";

interface Reservation {
  id: string;
  table_id: string | null;
  client_name: string;
  client_phone?: string;
  pax: number;
  start_time: string;
  end_time: string;
  status: "confirmed" | "seated" | "cancelled";
  channel: "WhatsApp" | "Instagram" | "Teléfono";
}

const timeSlots = [
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", 
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30", 
  "00:00", "00:30", "01:00", "01:30", "02:00"
];

function formatDateForQuery(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toHHMM(value: string): string {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  // Extract HH:MM from ISO string (e.g. 2026-04-04T21:00:00-03:00)
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  const match2 = value.match(/(\d{2}):(\d{2})/);
  if (match2) return `${match2[1]}:${match2[2]}`;
  return value;
}

export default function ReservasView({ selectedDate, setSelectedDate }: { selectedDate: Date, setSelectedDate: (d: Date) => void }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedResId, setSelectedResId] = useState<string | null>(null);
  const [filter, setFilter] = useState("Todo");

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isTomorrow = (() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return selectedDate.toDateString() === t.toDateString();
  })();

  const dateLabel = isToday
    ? "Hoy"
    : isTomorrow
    ? "Mañana"
    : selectedDate.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

  const fullDateLabel = selectedDate.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const changeDate = (delta: number) => {
    const nd = new Date(selectedDate);
    nd.setDate(nd.getDate() + delta);
    setSelectedDate(nd);
    setSelectedResId(null);
  };

  const goToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value + "T12:00:00"));
      setSelectedResId(null);
    }
  };

  const fetchTables = useCallback(async () => {
    const { data } = await supabase.from("mesas").select("*");
    if (data) {
      const real = (data as Table[]).filter(
        t => t.name && t.name.trim() !== "" &&
          !t.name.toUpperCase().startsWith("PARED") &&
          (t.capacity ?? 0) > 0
      );
      setTables(real);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    const dateStr = formatDateForQuery(selectedDate);
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = formatDateForQuery(nextDate);

    const { data } = await supabase
      .from("reservas")
      .select("*")
      .gte("start_time", dateStr)
      .lt("start_time", nextDateStr);

    if (data) {
      const addMins = (hhmm: string, mins: number) => {
        const [h, m] = hhmm.split(":").map(Number);
        const total = (h || 0) * 60 + (m || 0) + mins;
        return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      };
      const normalized = (data as Reservation[]).map(r => {
        const st = toHHMM(r.start_time);
        const et = r.end_time ? toHHMM(r.end_time) : addMins(st, 90);
        return { ...r, start_time: st, end_time: et };
      });
      setReservations(normalized);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchTables();
    fetchReservations();

    const channel = supabase
      .channel("realtime-mesas-reservas")
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, fetchTables)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, fetchReservations)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTables, fetchReservations]);

  const selectedRes = reservations.find(r => r.id === selectedResId);
  const selectedTable = selectedRes ? tables.find(t => t.id === selectedRes.table_id) : null;

  // Pixel-precise position: 100px per 30 min, baseline 18:00
  const getSlotPosition = (start: string, end: string) => {
    const toMin = (hhmm: string) => { 
      const [h, m] = hhmm.split(":").map(Number); 
      const adjH = h < 6 ? h + 24 : h;
      return adjH * 60 + m; 
    };
    const baseMin = 18 * 60;
    const startMin = toMin(start);
    const endMin = toMin(end);
    const left = Math.max(0, ((startMin - baseMin) / 30) * 100);
    const width = Math.max(((endMin - startMin) / 30) * 100, 100);
    return { left: `${left}px`, width: `${width}px` };
  };

  const updateReservationStatus = async (id: string, status: "confirmed" | "seated" | "cancelled") => {
    await supabase.from("reservas").update({ status }).eq("id", id);
    if (status === "seated" && selectedTable) {
      await supabase.from("mesas").update({
        status: "occupied",
        current_client: selectedRes?.client_name,
        time_elapsed: "0 min",
      }).eq("id", selectedTable.id);
    }
  };

  const unassigned = reservations.filter(r => !r.table_id && r.status !== "cancelled");

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 shrink-0 flex-wrap gap-3">
        {/* Zone filters */}
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-container-low p-1 rounded-xl">
            {["Todo", "Interior", "Terraza", "Barra"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f ? "bg-white shadow-sm text-stone-800" : "text-stone-500 hover:text-stone-800"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-colors">
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </button>
        </div>

        {/* Date navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors text-stone-600"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          <label className="relative flex items-center gap-2 bg-white border border-stone-200 shadow-sm rounded-xl px-4 py-2 cursor-pointer hover:bg-stone-50 transition-colors">
            <span className="material-symbols-outlined text-stone-400 text-[18px]">calendar_today</span>
            <div className="text-center">
              <p className="text-sm font-bold text-stone-800 leading-none">{dateLabel}</p>
              <p className="text-[10px] text-stone-400 mt-0.5 capitalize">{fullDateLabel}</p>
            </div>
            <input
              type="date"
              value={formatDateForQuery(selectedDate)}
              onChange={goToDate}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </label>

          <button
            onClick={() => changeDate(1)}
            className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors text-stone-600"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>

          {!isToday && (
            <button
              onClick={() => { setSelectedDate(new Date()); setSelectedResId(null); }}
              className="px-3 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Hoy
            </button>
          )}
        </div>

        <div className="hidden md:flex bg-stone-100 px-3 py-1.5 rounded-full items-center gap-2 border border-stone-200">
          <span className="material-symbols-outlined text-stone-400 text-lg">search</span>
          <input
            className="bg-transparent border-none text-xs focus:ring-0 w-48 text-stone-800 placeholder-stone-400 outline-none"
            placeholder="Buscar mesa o cliente..."
            type="text"
          />
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-[500px] h-[65vh]">
        {/* Agenda Grid */}
        <div className="flex-1 bg-white rounded-2xl overflow-hidden flex flex-col shadow-sm border border-stone-200 relative">
          <div className="flex-1 overflow-auto custom-scrollbar relative bg-white">
            <div className="min-w-fit flex flex-col min-h-full">
              {/* Timeline Header */}
              <div className="flex border-b border-stone-100 shrink-0 sticky top-0 bg-white z-40">
                <div className="w-36 flex-shrink-0 p-4 font-bold text-xs text-stone-500 bg-stone-50 border-r border-stone-100 flex items-center sticky left-0 z-50">
                  Mesa / Zona
                </div>
                <div className="flex-1 flex no-scrollbar">
              {timeSlots.map(time => (
                <div
                  key={time}
                  className="flex-1 min-w-[100px] py-3 text-center text-[10px] font-black text-stone-400 border-r border-stone-100 uppercase tracking-widest shrink-0"
                >
                  {time}
                </div>
              ))}
            </div>
          </div>

              {/* Grid Rows */}
              <div className="flex flex-col relative w-[calc(144px+1700px)]">

                {/* No reservations for this date */}
            {reservations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-stone-400 gap-3">
                <span className="material-symbols-outlined text-5xl opacity-30">event_busy</span>
                <p className="text-sm font-semibold">No hay reservas para {dateLabel.toLowerCase()}</p>
              </div>
            )}

                {/* Unassigned reservas row */}
                {unassigned.length > 0 && filter === "Todo" && (
                  <div className="flex border-b-2 border-secondary/20 group bg-secondary/5 h-24 shrink-0 relative">
                    <div className="w-36 flex-shrink-0 p-4 bg-secondary/10 border-r border-secondary/20 flex flex-col justify-center sticky left-0 z-30">
                      <span className="font-bold text-secondary text-sm whitespace-nowrap">Sin mesa</span>
                      <span className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest">Sin asignar</span>
                    </div>
                    <div className="w-[1700px] relative overflow-hidden flex items-center gap-2 px-3">
                  {unassigned.map(res => {
                    const isSelected = selectedResId === res.id;
                    return (
                      <div
                        key={res.id}
                        onClick={() => setSelectedResId(res.id)}
                        className={`flex flex-col justify-center rounded-xl p-3 cursor-pointer transition-all shadow-sm h-16 min-w-[160px] bg-secondary text-white ${isSelected ? "ring-2 ring-offset-2 ring-stone-900" : "hover:scale-[1.02]"}`}
                      >
                        <p className="font-bold text-xs truncate">{res.client_name}</p>
                        <div className="flex items-center gap-1 opacity-80 mt-0.5">
                          <span className="material-symbols-outlined text-[10px]">person</span>
                          <span className="font-semibold text-[10px]">{res.pax}p</span>
                          <span className="mx-1">•</span>
                          <span className="font-semibold text-[10px]">{res.start_time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

                {/* Table rows */}
                {tables
                  .filter(t => filter === "Todo" || (t.zone ?? "").toLowerCase() === filter.toLowerCase())
                  .map(table => {
                    const tableRes = reservations.filter(r => r.table_id === table.id);
                    return (
                      <div
                        key={table.id}
                        className="flex border-b border-stone-100 group hover:bg-stone-50/50 transition-colors h-24 shrink-0 relative"
                      >
                        <div className="w-36 flex-shrink-0 p-4 bg-stone-50/50 border-r border-stone-100 flex flex-col justify-center sticky left-0 z-30">
                          <span className="font-bold text-stone-800 text-sm whitespace-nowrap">{table.name}</span>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            {table.zone} · {table.capacity}p
                          </span>
                        </div>
                        <div className="w-[1700px] relative bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAwIDBMMTAwIDEwMCIgc3Ryb2tlPSIjZjVmNWY0IiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz48L3N2Zz4=')]">
                      {tableRes.map(res => {
                        const pos = getSlotPosition(res.start_time, res.end_time);
                        const isSelected = selectedResId === res.id;
                        let bgClass = "bg-secondary text-white shadow-secondary/20";
                        if (res.status === "seated") bgClass = "bg-primary text-white shadow-primary/20";
                        if (res.status === "cancelled") bgClass = "bg-stone-200 text-stone-500 line-through opacity-60";
                        return (
                          <div
                            key={res.id}
                            onClick={() => setSelectedResId(res.id)}
                            className={`absolute top-2 bottom-2 rounded-xl p-3 flex flex-col justify-center cursor-pointer transition-all shadow-sm z-10 overflow-hidden ${bgClass} ${isSelected ? "ring-2 ring-offset-2 ring-stone-900 border-none" : "border border-white/20 hover:scale-[1.02]"}`}
                            style={{ left: pos.left, width: pos.width }}
                          >
                            <p className="font-bold text-xs truncate max-w-full">{res.client_name}</p>
                            <div className="flex items-center gap-1 opacity-80 mt-0.5">
                              <span className="material-symbols-outlined text-[10px]">person</span>
                              <span className="font-semibold text-[10px]">{res.pax}p</span>
                              <span className="mx-1">•</span>
                              <span className="font-semibold text-[10px]">{res.start_time} - {res.end_time}</span>
                            </div>
                          </div>
                        );
                      })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedRes && (
          <aside className="w-80 lg:w-96 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <div className="bg-surface-container-lowest p-6 lg:p-8 rounded-2xl shadow-lg border border-stone-200 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-extrabold font-headline text-on-surface">{selectedRes.client_name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest ${
                      selectedRes.status === "confirmed" ? "bg-secondary-container/50 text-secondary" :
                      selectedRes.status === "seated" ? "bg-primary/10 text-primary" :
                      "bg-stone-100 text-stone-500"
                    }`}>
                      {selectedRes.status === "confirmed" ? "Confirmada" : selectedRes.status === "seated" ? "Sentados" : "Cancelada"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Por {selectedRes.channel}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedResId(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Horario</label>
                    <p className="text-lg font-headline font-extrabold text-on-surface">{selectedRes.start_time}</p>
                    <p className="text-xs text-stone-500 font-semibold">hasta {selectedRes.end_time}</p>
                  </div>
                  <div className="flex flex-col gap-1 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Mesa</label>
                    <p className="text-lg font-headline font-extrabold text-on-surface">{selectedTable?.name ?? "Sin asignar"}</p>
                    <p className="text-xs text-stone-500 font-semibold">{selectedRes.pax} Personas</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Contacto</label>
                  <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-stone-400">call</span>
                    {selectedRes.client_phone || "No registrado"}
                  </p>
                </div>

                {selectedRes.status === "confirmed" && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <button
                      onClick={() => updateReservationStatus(selectedRes.id, "seated")}
                      className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 text-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                      Confirmar llegada (Sentar)
                    </button>
                    <button
                      onClick={() => updateReservationStatus(selectedRes.id, "cancelled")}
                      className="w-full text-stone-400 py-2 font-medium text-xs hover:text-red-600 transition-colors flex items-center justify-center gap-1 mt-2"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                      Marcar No Show / Cancelar
                    </button>
                  </div>
                )}

                {selectedRes.status === "seated" && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-stone-100">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex gap-3 text-primary">
                      <span className="material-symbols-outlined">info</span>
                      <p className="text-xs font-medium">Los clientes ya han sido sentados. Las acciones se gestionan desde el plano principal.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

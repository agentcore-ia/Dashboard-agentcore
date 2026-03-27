"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ─── Evolution API Direct (same as Evolution Manager — bypasses Next.js proxy) ──
// CORS_ORIGIN=* on the Evolution API allows direct browser calls
const EVO_URL    = 'https://agentcore-evolution-api.8zp1cp.easypanel.host';
const EVO_TOKEN  = '465E65D048F8-42B4-B162-4CF3107E70D8'; // instance token
const EVO_INST   = 'agentcore test';

// ─── QR Code Modal ─────────────────────────────────────────────────────────────
function QRModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'qr' | 'pairing'>('qr');
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrCount, setQrCount]   = useState<number>(-1);
  const [loading, setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);
  
  // Pairing Code states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const qrIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Direct fetch — identical to what Evolution Manager does
  const fetchQR = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res  = await fetch(
        `${EVO_URL}/instance/connect/${encodeURIComponent(EVO_INST)}`,
        { headers: { apikey: EVO_TOKEN }, cache: 'no-store' }
      );
      const data = await res.json();
      if (data.instance?.state === 'open') { setConnected(true); return; }
      if (data.base64) {
        setQrBase64(data.base64);
        setQrCount(prev => {
          if (prev !== -1 && prev !== data.count) setLoading(true);
          return data.count ?? prev;
        });
      }
    } catch { /* keep last QR */ }
    finally   { setLoading(false); }
  }, []);

  const handlePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    setPairingLoading(true);
    setPairingCode(null);
    try {
      const num = phoneNumber.replace(/\D/g, '');
      const res = await fetch('/api/evolution/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num })
      });
      const data = await res.json();
      
      const code = data.code || data.pairingCode || data.pairing_code;
      
      if (code && code.length < 20) {
        setPairingCode(code);
      } else {
        // If it returns a long code (QR) or an error, show the JSON for debugging
        const raw = JSON.stringify(data, null, 2);
        throw new Error(`API returned: ${raw}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setPairingLoading(false);
    }
  };

  const checkStatus = useCallback(async () => {
    try {
      const sr = await fetch('/api/evolution/status');
      const sd = await sr.json();
      if (sd.instance?.state === 'open') setConnected(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (mode === 'qr') {
      fetchQR(true);
      qrIntervalRef.current = setInterval(() => fetchQR(false), 7000);
    } else {
      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
        qrIntervalRef.current = null;
      }
    }

    statusIntervalRef.current = setInterval(checkStatus, 3000);
    return () => {
      if (qrIntervalRef.current)     clearInterval(qrIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [mode, fetchQR, checkStatus]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-sm w-full mx-4 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors">
          <span className="material-symbols-outlined text-sm">close</span>
        </button>

        {connected ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-green-600 text-3xl fill-icon">check_circle</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2">¡Conectado!</h3>
            <p className="text-stone-500 text-sm">WhatsApp vinculado correctamente.</p>
            <button onClick={onClose} className="mt-6 bg-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:shadow-lg transition-all">Cerrar</button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h3 className="font-headline text-xl font-bold text-on-surface mb-4">Conectar WhatsApp</h3>
              
              <div className="flex bg-stone-100 p-1 rounded-xl mb-6">
                <button 
                  onClick={() => setMode('qr')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'qr' ? 'bg-white text-primary shadow-sm' : 'text-stone-400 opacity-60'}`}
                >
                  Código QR
                </button>
                <button 
                  onClick={() => setMode('pairing')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'pairing' ? 'bg-white text-primary shadow-sm' : 'text-stone-400 opacity-60'}`}
                >
                  Número de Teléfono
                </button>
              </div>

              {mode === 'qr' ? (
                <p className="text-stone-500 text-xs">
                  Abrí WhatsApp → Menú (<strong>⋮</strong>) → <strong>Dispositivos vinculados</strong> → Vincular dispositivo
                </p>
              ) : (
                <p className="text-stone-500 text-xs text-center px-4">
                  Vinculá usando tu número. Recibirás un código de 8 dígitos para ingresar en tu app de WhatsApp.
                </p>
              )}
            </div>

            {mode === 'qr' ? (
              loading && !qrBase64 ? (
                <div className="w-60 h-60 mx-auto flex flex-col items-center justify-center bg-stone-50 rounded-2xl gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-stone-400">Obteniendo código QR...</p>
                </div>
              ) : qrBase64 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className={`p-3 bg-white rounded-2xl shadow-inner border border-stone-100 transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                      <img src={qrBase64} alt="QR WhatsApp" className="w-56 h-56 rounded-xl" />
                    </div>
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    <div className="absolute -top-2 -right-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[10px] font-black">
                      #{qrCount}
                    </div>
                  </div>
                  <div className="w-full bg-stone-50 rounded-xl px-3 py-2 text-center text-[10px] text-stone-400 font-semibold uppercase tracking-wider">
                    Actualizando automáticamente...
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-stone-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">error_outline</span>
                  <p className="text-sm mb-4">No se pudo obtener el QR.</p>
                  <button onClick={() => fetchQR(true)} className="bg-primary text-white px-5 py-2 rounded-xl font-bold text-sm">Reintentar</button>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-4">
                {!pairingCode ? (
                  <form onSubmit={handlePairing} className="flex flex-col gap-3">
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Ej: 54911..."
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
                        autoFocus
                      />
                      <span className="absolute right-4 top-3.5 material-symbols-outlined text-stone-300">phone_iphone</span>
                    </div>
                    <button
                      type="submit"
                      disabled={pairingLoading || !phoneNumber}
                      className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                    >
                      {pairingLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                      ) : 'Generar Código'}
                    </button>
                    <p className="text-[10px] text-stone-400 text-center uppercase tracking-wider font-bold">Incluí el código de país (54...)</p>
                  </form>
                ) : (
                  <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 flex flex-col items-center">
                    <p className="text-xs text-stone-400 font-bold mb-4 uppercase tracking-widest text-center">Ingresá este código en WhatsApp</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mb-6 max-w-xs">
                      {pairingCode.replace(/-/g, '').split('').map((char, i) => (
                        <div key={i} className="w-9 h-11 bg-white rounded-lg shadow-sm border border-stone-100 flex items-center justify-center text-lg font-black text-primary">
                          {char}
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => setPairingCode(null)}
                      className="text-primary text-[10px] font-black uppercase tracking-wider underline opacity-60 hover:opacity-100"
                    >
                      Usar otro número
                    </button>
                  </div>
                )}
                
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-primary text-xl">info</span>
                    <p className="text-[10px] text-primary/70 font-semibold leading-relaxed">
                      En WhatsApp: Menú → Dispositivos vinculados → Vincular dispositivo → <strong>Vincular con número de teléfono</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ─── Main Page ──────────────────────────────────────────────────────────────────
type ConnectionStatus = 'loading' | 'open' | 'close' | 'error';

const ModulosPage = () => {
  const [activeModules, setActiveModules] = useState({
    whatsapp: true,
    instagram: false,
    reservas: false,
    phone: false,
    google: false,
    delivery: true
  });
  const [waStatus, setWaStatus] = useState<ConnectionStatus>('loading');
  const [showQR, setShowQR] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/evolution/status');
      const data = await res.json();
      const state = data.instance?.state;
      setWaStatus(state === 'open' ? 'open' : 'close');
    } catch {
      setWaStatus('error');
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const toggleModule = (module: string) => {
    setActiveModules(prev => ({
      ...prev,
      // @ts-ignore
      [module]: !prev[module]
    }));
  };

  const statusConfig: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
    loading: { label: 'Verificando...', dot: 'bg-stone-300 animate-pulse', text: 'text-stone-400' },
    open:    { label: 'Conectado',      dot: 'bg-green-500',               text: 'text-green-600' },
    close:   { label: 'Desconectado',   dot: 'bg-red-500 animate-pulse',   text: 'text-red-600'   },
    error:   { label: 'Sin respuesta',  dot: 'bg-amber-400 animate-pulse', text: 'text-amber-600' },
  };
  const sc = statusConfig[waStatus];

  return (
    <div className="max-w-7xl mx-auto">
      {showQR && <QRModal onClose={() => { setShowQR(false); checkStatus(); }} />}

      {/* Header */}
      <div className="mb-12">
        <h2 className="font-headline text-4xl font-bold tracking-tight text-on-surface mb-2">Gestión de Módulos</h2>
        <p className="font-body text-xl text-stone-500">Activa o desactiva las herramientas adicionales para tu negocio.</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

        {/* Card 1: WhatsApp — live status + QR reconnect */}
        <div className={`group relative p-8 rounded-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
          activeModules.whatsapp
            ? "bg-surface-container-lowest shadow-[0_4px_40px_0_rgba(173,44,0,0.04)] ring-2 ring-primary/10"
            : "bg-surface-container-low opacity-80 hover:opacity-100 hover:bg-surface-container-lowest"
        }`}>
          <div className="absolute top-6 right-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={activeModules.whatsapp} className="sr-only peer" onChange={() => toggleModule('whatsapp')} />
              <div className="w-12 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${activeModules.whatsapp ? "bg-primary/10 text-primary" : "bg-stone-200 text-stone-400"}`}>
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-3 font-headline">Agente WhatsApp</h3>
            <p className="text-body text-stone-500 leading-relaxed">Automatiza tus conversaciones y pedidos por WhatsApp con inteligencia artificial.</p>

            {activeModules.whatsapp && (
              <div className="mt-4 flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`}></span>
                <span className={`text-xs font-bold ${sc.text}`}>{sc.label}</span>
                <span className="ml-auto text-[10px] text-stone-400 font-mono">agentcore test</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className={`text-xs font-bold tracking-wider uppercase ${activeModules.whatsapp ? "text-primary" : "text-stone-400"}`}>
              {activeModules.whatsapp ? "Activo" : "Inactivo"}
            </span>
            {activeModules.whatsapp && waStatus !== 'open' && waStatus !== 'loading' && (
              <button
                onClick={() => setShowQR(true)}
                className="bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md hover:shadow-primary/20 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                Reconectar
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Instagram */}
        <div className={`group relative p-8 rounded-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
          activeModules.instagram
            ? "bg-surface-container-lowest shadow-[0_4px_40px_0_rgba(173,44,0,0.04)] ring-2 ring-primary/10"
            : "bg-surface-container-low opacity-80 hover:opacity-100 hover:bg-surface-container-lowest"
        }`}>
          <div className="absolute top-6 right-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={activeModules.instagram} className="sr-only peer" onChange={() => toggleModule('instagram')} />
              <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${activeModules.instagram ? "bg-pink-100 text-pink-600" : "bg-stone-200 text-stone-400"}`}>
              <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.981 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-3 font-headline">Agente Instagram</h3>
            <p className="text-body text-stone-500 leading-relaxed">Responde comentarios y mensajes directos de tus seguidores automáticamente.</p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className={`text-xs font-bold tracking-wider uppercase ${activeModules.instagram ? "text-primary" : "text-stone-400"}`}>
              {activeModules.instagram ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Card 3: Reservas */}
        <div className={`group relative p-8 rounded-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
          activeModules.reservas
            ? "bg-surface-container-lowest shadow-[0_4px_40px_0_rgba(173,44,0,0.04)] ring-2 ring-primary/10"
            : "bg-surface-container-low opacity-80 hover:opacity-100 hover:bg-surface-container-lowest"
        }`}>
          <div className="absolute top-6 right-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={activeModules.reservas} className="sr-only peer" onChange={() => toggleModule('reservas')} />
              <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${activeModules.reservas ? "bg-blue-100 text-blue-600" : "bg-stone-200 text-stone-400"}`}>
              <span className="material-symbols-outlined text-3xl">calendar_month</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-3 font-headline">Reservas</h3>
            <p className="text-body text-stone-500 leading-relaxed">Gestiona las reservas de mesas de tu local de forma organizada y automática.</p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className={`text-xs font-bold tracking-wider uppercase ${activeModules.reservas ? "text-primary" : "text-stone-400"}`}>
              {activeModules.reservas ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Card 4: Agente Telefónico */}
        <div className={`group relative p-8 rounded-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
          activeModules.phone
            ? "bg-surface-container-lowest shadow-[0_4px_40px_0_rgba(173,44,0,0.04)] ring-2 ring-primary/10"
            : "bg-surface-container-low opacity-80 hover:opacity-100 hover:bg-surface-container-lowest"
        }`}>
          <div className="absolute top-6 right-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={activeModules.phone} className="sr-only peer" onChange={() => toggleModule('phone')} />
              <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${activeModules.phone ? "bg-amber-100 text-amber-600" : "bg-stone-200 text-stone-400"}`}>
              <span className="material-symbols-outlined text-3xl">call</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-3 font-headline">Agente Telefónico</h3>
            <p className="text-body text-stone-500 leading-relaxed">Atiende llamadas y resuelve dudas comunes de tus clientes mediante voz.</p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className={`text-xs font-bold tracking-wider uppercase ${activeModules.phone ? "text-primary" : "text-stone-400"}`}>
              {activeModules.phone ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Card 5: Google Business */}
        <div className={`group relative p-8 rounded-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
          activeModules.google
            ? "bg-surface-container-lowest shadow-[0_4px_40px_0_rgba(173,44,0,0.04)] ring-2 ring-primary/10"
            : "bg-surface-container-low opacity-80 hover:opacity-100 hover:bg-surface-container-lowest"
        }`}>
          <div className="absolute top-6 right-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={activeModules.google} className="sr-only peer" onChange={() => toggleModule('google')} />
              <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${activeModules.google ? "bg-green-100 text-green-600" : "bg-stone-200 text-stone-400"}`}>
              <span className="material-symbols-outlined text-3xl">store</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-3 font-headline">Google Business</h3>
            <p className="text-body text-stone-500 leading-relaxed">Gestiona reseñas y mensajes de tu perfil de Google My Business.</p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className={`text-xs font-bold tracking-wider uppercase ${activeModules.google ? "text-primary" : "text-stone-400"}`}>
              {activeModules.google ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Card 6: Delivery Integrations */}
        <div className={`group relative p-8 rounded-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
          activeModules.delivery
            ? "bg-surface-container-lowest shadow-[0_4px_40px_0_rgba(173,44,0,0.04)] ring-2 ring-primary/10"
            : "bg-surface-container-low opacity-80 hover:opacity-100 hover:bg-surface-container-lowest"
        }`}>
          <div className="absolute top-6 right-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={activeModules.delivery} className="sr-only peer" onChange={() => toggleModule('delivery')} />
              <div className="w-12 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          <div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${activeModules.delivery ? "bg-primary/10 text-primary" : "bg-stone-200 text-stone-400"}`}>
              <span className="material-symbols-outlined text-3xl fill-icon">delivery_dining</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-3 font-headline">Delivery Integrations</h3>
            <p className="text-body text-stone-500 leading-relaxed">Conecta con plataformas externas como UberEats o Rappi.</p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className={`text-xs font-bold tracking-wider uppercase ${activeModules.delivery ? "text-primary" : "text-stone-400"}`}>
              {activeModules.delivery ? "Activo" : "Inactivo"}
            </span>
            {activeModules.delivery && (
              <button className="text-primary font-bold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                Vincular <span className="material-symbols-outlined text-sm">link</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Promotional Section */}
      <div className="mt-16 bg-primary-container/10 p-10 rounded-[2rem] flex flex-col lg:flex-row items-center gap-10 overflow-hidden relative">
        <div className="flex-1 z-10">
          <span className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter mb-4 inline-block">Proximamente</span>
          <h2 className="text-3xl font-bold text-primary mb-4 font-headline">Inteligencia de Inventario</h2>
          <p className="text-body text-on-secondary-container max-w-lg mb-8">Estamos cocinando una nueva herramienta para predecir tus necesidades de stock basadas en la demanda histórica de tus pedidos de WhatsApp.</p>
          <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all active:scale-95">Me interesa</button>
        </div>
        <div className="w-full lg:w-1/3 aspect-video lg:aspect-square rounded-2xl overflow-hidden shadow-2xl z-10">
          <img alt="Kitchen stock and fresh ingredients" className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop" />
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default ModulosPage;

import React, { useState, useEffect } from 'react';
import { Wifi, QrCode, AlertTriangle, Radio, RefreshCw, Shield, CheckCircle, Search, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export const HardwareWifiView: React.FC = () => {
  const { wifiNetworks, fetchScan, provisionWifi, resetWifi } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [identity, setIdentity] = useState('');
  const [isEap, setIsEap] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const filteredNetworks = wifiNetworks.filter(n =>
    n.ssid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.encryption && n.encryption.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  const handleSelectNetwork = (netSSID: string, enc: string) => {
    setSsid(netSSID);
    const eap = enc === 'eap' || netSSID.toLowerCase().includes('eduroam');
    setIsEap(eap);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setMessage(null);

    const res = await provisionWifi(ssid, password, isEap ? 'eap' : 'psk', isEap ? identity : undefined);
    setConnecting(false);
    setIsSuccess(res.ok);
    setMessage(res.message || (res.ok ? 'Configuração enviada com sucesso!' : 'Falha na configuração'));

    if (res.ok) {
      setPassword('');
      setIdentity('');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-slate-100">Hardware & Conectividade</h2>
        <button
          onClick={() => fetchScan()}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
        >
          <RefreshCw className="w-4 h-4" /> Escanear Redes
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provisioning Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
              <Radio className="w-5 h-5 text-blue-500" />
              <h3 className="font-medium text-lg text-slate-200">Configuração Wi-Fi (Client & AP)</h3>
            </div>

            {/* Discovered networks with dynamic search bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  Redes nas Proximidades ({filteredNetworks.length})
                </label>
                {wifiNetworks.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Total: {wifiNetworks.length}
                  </span>
                )}
              </div>

              {/* Dynamic search input */}
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filtrar redes por nome ou tipo (ex: IFSP, eduroam, psk)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {filteredNetworks.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1.5 bg-slate-950 rounded-lg border border-slate-800 scrollbar-thin">
                  {filteredNetworks.map((n) => (
                    <button
                      key={n.ssid}
                      type="button"
                      onClick={() => handleSelectNetwork(n.ssid, n.encryption)}
                      className={`text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all ${
                        ssid === n.ssid
                          ? 'bg-cyan-600/90 text-white font-medium shadow-sm border border-cyan-400'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <Wifi className={`w-3 h-3 ${
                        (n.rssi || -70) >= -60 ? 'text-emerald-400' :
                        (n.rssi || -70) >= -75 ? 'text-amber-400' : 'text-slate-400'
                      }`} />
                      <span className="font-medium">{n.ssid}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase ${
                        n.encryption === 'eap'
                          ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                          : n.encryption === 'open'
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                      }`}>
                        {n.encryption}
                      </span>
                      {n.rssi && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {n.rssi}dBm
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-500">
                  {searchTerm ? `Nenhuma rede encontrada para "${searchTerm}"` : 'Nenhuma rede detectada no momento.'}
                </div>
              )}
            </div>
            
            <form onSubmit={handleConnect} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">SSID (Nome da Rede)</label>
                <input 
                  type="text" 
                  required
                  value={ssid}
                  onChange={e => setSsid(e.target.value)}
                  placeholder="Nome da sua rede Wi-Fi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="eap-checkbox"
                  checked={isEap}
                  onChange={(e) => setIsEap(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <label htmlFor="eap-checkbox" className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" /> Rede Institucional 802.1X EAP (ex: eduroam)
                </label>
              </div>

              {isEap && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Identidade / Usuário Institucional</label>
                  <input 
                    type="text" 
                    required
                    value={identity}
                    onChange={e => setIdentity(e.target.value)}
                    placeholder="usuario@unesp.br"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Senha (PSK / EAP Pass)</label>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3 text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <p>O aparelho tentará a associação por 60 segundos. Se falhar, o modo AP (192.168.4.1) será automaticamente restaurado por contingência de hardware.</p>
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  isSuccess ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {isSuccess && <CheckCircle className="w-4 h-4 shrink-0" />}
                  <span>{message}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={connecting}
                className="mt-1 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2 shadow"
              >
                {connecting ? 'Aplicando e Conectando...' : <><Wifi className="w-4 h-4" /> Salvar e Conectar</>}
              </button>
            </form>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={() => resetWifi()}
              className="text-xs text-slate-400 hover:text-rose-400 underline transition-colors"
            >
              Forçar reinicialização para Ponto de Acesso (AP Mode)
            </button>
          </div>
        </div>

        {/* HDMI Framebuffer & Mobile Pairing Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
          <div className="p-4 bg-white rounded-2xl mb-4 shadow-xl">
            <QrCode className="w-44 h-44 text-slate-950" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-slate-100">Ponte Kiosk HDMI (/dev/fb0)</h3>
          <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">
            O Kiosk exibe este QR Code diretamente na TV com resolução 1080p e proteção anti-burnin por pixel-shift sinusoidal (±2px).
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 rounded-full border border-slate-800 text-xs font-mono text-blue-400">
            <span>http://{window.location.host || '192.168.1.153:8080'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

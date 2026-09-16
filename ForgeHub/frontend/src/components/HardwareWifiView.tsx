import React, { useState, useEffect } from 'react';
import { Wifi, QrCode, AlertTriangle, Radio, RefreshCw, CheckCircle, Search, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { WifiProvision } from '../types';

export const HardwareWifiView: React.FC = () => {
  const { wifiNetworks, fetchScan, provisionWifi, resetWifi } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [identity, setIdentity] = useState('');
  const [security, setSecurity] = useState<WifiProvision['type']>('psk');
  const [method, setMethod] = useState<NonNullable<WifiProvision['method']>>('PEAP');
  const [phase2, setPhase2] = useState('MSCHAPV2');
  const [anonymousIdentity, setAnonymousIdentity] = useState('');
  const [domain, setDomain] = useState('');
  const [certs, setCerts] = useState({ ca_cert: '', client_cert: '', private_key: '' });
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState(0);
  const [certificateReset, setCertificateReset] = useState(0);
  const [awaitingConnection, setAwaitingConnection] = useState(false);
  const isEap = security === 'eap';
  const fieldClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500';
  const readCertificate = async (key: keyof typeof certs, file?: File) => {
    setCerts(old => ({ ...old, [key]: '' }));
    setFileErrors(old => ({ ...old, [key]: '' }));
    if (!file) return;
    if (file.size > 32768) { setFileErrors(old => ({ ...old, [key]: 'O arquivo PEM deve ter no máximo 32 KB.' })); return; }
    setPendingFiles(n => n + 1);
    try { const value = await file.text(); setCerts(old => ({ ...old, [key]: value })); }
    catch { setFileErrors(old => ({ ...old, [key]: 'Não foi possível ler o arquivo.' })); }
    finally { setPendingFiles(n => n - 1); }
  };
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

  useEffect(() => {
    if (!awaitingConnection) return;
    let cancelled = false;
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch('/api/status');
        if (!response.ok) return;
        const status = await response.json();
        if (cancelled || status.provisioning) return;
        if (status.client_connected) {
          setIsSuccess(true);
          setMessage(`Conectado a ${status.client_ssid}. IP: ${status.client_ip}`);
          setAwaitingConnection(false);
        } else if (status.provisioning_error) {
          setIsSuccess(false);
          setMessage(status.provisioning_error);
          setAwaitingConnection(false);
        }
      } catch { /* The AP can disappear while the radio switches networks. */ }
      finally { busy = false; }
    }, 2000);
    const timeout = window.setTimeout(() => {
      setAwaitingConnection(false);
      setIsSuccess(false);
      setMessage('Não foi possível confirmar a conexão nesta página. Conecte-se à nova rede e acesse a TV box pelo novo endereço, ou retorne ao ponto de acesso se a tentativa falhou.');
    }, 90000);
    return () => { cancelled = true; window.clearInterval(timer); window.clearTimeout(timeout); };
  }, [awaitingConnection]);

  const handleSelectNetwork = (netSSID: string, enc: string) => {
    setSsid(netSSID);
    setSecurity((['open', 'psk', 'sae', 'owe', 'eap'].includes(enc) ? enc : 'psk') as WifiProvision['type']);
    setPassword(''); setIdentity(''); setMessage(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setMessage(null);

    const res = await provisionWifi({ ssid, type: security,
      ...((security === 'psk' || security === 'sae' || (isEap && method !== 'TLS')) ? { password } : {}),
      ...(isEap ? { identity, method, phase2, anonymous_identity: anonymousIdentity,
        ...(method !== 'PWD' ? { domain, ca_cert: certs.ca_cert } : {}),
        ...(method === 'TLS' ? { client_cert: certs.client_cert, private_key: certs.private_key } : {}) } : {}),
    });
    setConnecting(false);
    setIsSuccess(res.ok);
    setMessage(res.message || (res.ok ? 'Configuração enviada com sucesso!' : 'Falha na configuração'));

    if (res.ok) {
      setAwaitingConnection(true);
      setPassword('');
      setIdentity('');
      setCerts({ ca_cert: '', client_cert: '', private_key: '' });
      setCertificateReset(n => n + 1);
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

              <label className="text-sm text-slate-400">Segurança
                <select aria-label="Segurança" className={fieldClass} value={security} onChange={e => setSecurity(e.target.value as WifiProvision['type'])}>
                  <option value="psk">WPA / WPA2 Pessoal</option><option value="sae">WPA3 Pessoal (SAE)</option>
                  <option value="open">Aberta (sem senha)</option><option value="owe">Aberta aprimorada (OWE)</option>
                  <option value="eap">Empresarial / 802.1X (EAP)</option>
                </select>
              </label>
              {isEap && <>
                <label className="text-sm text-slate-400">Método EAP
                  <select className={fieldClass} value={method} onChange={e => { setMethod(e.target.value as NonNullable<WifiProvision['method']>); setPhase2('MSCHAPV2'); }}>
                    <option>PEAP</option><option>TTLS</option><option>PWD</option><option>TLS</option>
                  </select>
                </label>
                {(method === 'PEAP' || method === 'TTLS') && <label className="text-sm text-slate-400">Autenticação interna
                  <select className={fieldClass} value={phase2} onChange={e => setPhase2(e.target.value)}>
                    <option>MSCHAPV2</option><option>GTC</option>{method === 'TTLS' && <option>PAP</option>}
                  </select>
                </label>}
                <label className="text-sm text-slate-400">Identidade / usuário
                  <input required className={fieldClass} value={identity} onChange={e => setIdentity(e.target.value)} placeholder="usuario@instituicao.br" autoComplete="username" />
                </label>
                {method !== 'PWD' && <>
                  <label className="text-sm text-slate-400">Domínio do servidor de autenticação
                    <input required className={fieldClass} value={domain} onChange={e => setDomain(e.target.value)} placeholder="instituicao.br" />
                  </label>
                  <label className="text-sm text-slate-400">Certificado CA (.pem, opcional se a CA já for confiável no sistema)
                    <input key={`ca-${certificateReset}`} type="file" accept=".pem,.crt,.cer" className={fieldClass} onChange={e => void readCertificate('ca_cert', e.target.files?.[0])} />
                  </label>
                </>}
                {(method === 'PEAP' || method === 'TTLS') && <label className="text-sm text-slate-400">Identidade anônima (opcional)
                  <input className={fieldClass} value={anonymousIdentity} onChange={e => setAnonymousIdentity(e.target.value)} placeholder="anonymous@instituicao.br" />
                </label>}
                {method === 'TLS' && <>
                  <label className="text-sm text-slate-400">Certificado do cliente (.pem)
                    <input key={`cert-${certificateReset}`} required type="file" accept=".pem,.crt" className={fieldClass} onChange={e => void readCertificate('client_cert', e.target.files?.[0])} />
                  </label>
                  <label className="text-sm text-slate-400">Chave privada do cliente (.pem, sem senha)
                    <input key={`key-${certificateReset}`} required type="file" accept=".pem,.key" className={fieldClass} onChange={e => void readCertificate('private_key', e.target.files?.[0])} />
                  </label>
                </>}
              </>}
              {(security === 'psk' || security === 'sae' || (isEap && method !== 'TLS')) && <label className="text-sm text-slate-400">Senha
                <input type="password" required className={fieldClass} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              </label>}
              <p className="text-xs text-slate-500">Para rede oculta, digite o SSID. WPA3 e OWE dependem do adaptador e do driver. Em redes EAP, use os dados e certificados fornecidos pela instituição.</p>
              {isEap && Object.values(fileErrors).some(Boolean) && <p role="alert" className="text-xs text-rose-400">{Object.values(fileErrors).filter(Boolean).join(' ')}</p>}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3 text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <p>Ao aplicar, o ponto de acesso será interrompido. Se a conexão falhar, ele será restaurado. Após conectar, use o endereço da TV box na nova rede.</p>
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  isSuccess ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {isSuccess && <CheckCircle className="w-4 h-4 shrink-0" />}
                  <span role="status">{message}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={connecting || awaitingConnection || pendingFiles > 0 || (isEap && Object.values(fileErrors).some(Boolean))}
                className="mt-1 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2 shadow"
              >
                {connecting || awaitingConnection ? 'Aguardando conexão...' : <><Wifi className="w-4 h-4" /> Salvar e Conectar</>}
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

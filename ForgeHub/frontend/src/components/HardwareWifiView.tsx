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
  const fieldClass = 'w-full bg-forge-surface-2 border border-forge-border rounded-lg px-4 py-2 text-xs sm:text-sm text-forge-text focus:outline-none focus:border-forge-primary transition-colors';

  const readCertificate = async (key: keyof typeof certs, file?: File) => {
    setCerts(old => ({ ...old, [key]: '' }));
    setFileErrors(old => ({ ...old, [key]: '' }));
    if (!file) return;
    if (file.size > 32768) { 
      setFileErrors(old => ({ ...old, [key]: 'O arquivo PEM deve ter no máximo 32 KB.' })); 
      return; 
    }
    setPendingFiles(n => n + 1);
    try { 
      const value = await file.text(); 
      setCerts(old => ({ ...old, [key]: value })); 
    } catch { 
      setFileErrors(old => ({ ...old, [key]: 'Não foi possível ler o arquivo.' })); 
    } finally { 
      setPendingFiles(n => n - 1); 
    }
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
      } catch { /* Ponto de acesso pode reiniciar */ }
      finally { busy = false; }
    }, 2000);
    const timeout = window.setTimeout(() => {
      setAwaitingConnection(false);
      setIsSuccess(false);
      setMessage('Não foi possível confirmar a conexão nesta página. Conecte-se à nova rede e acesse a TV box pelo novo endereço.');
    }, 90000);
    return () => { cancelled = true; window.clearInterval(timer); window.clearTimeout(timeout); };
  }, [awaitingConnection]);

  const handleSelectNetwork = (netSSID: string, enc: string) => {
    setSsid(netSSID);
    setSecurity((['open', 'psk', 'sae', 'owe', 'eap'].includes(enc) ? enc : 'psk') as WifiProvision['type']);
    setPassword(''); 
    setIdentity(''); 
    setMessage(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setMessage(null);

    const res = await provisionWifi({ 
      ssid, 
      type: security,
      ...((security === 'psk' || security === 'sae' || (isEap && method !== 'TLS')) ? { password } : {}),
      ...(isEap ? { 
        identity, 
        method, 
        phase2, 
        anonymous_identity: anonymousIdentity,
        ...(method !== 'PWD' ? { domain, ca_cert: certs.ca_cert } : {}),
        ...(method === 'TLS' ? { client_cert: certs.client_cert, private_key: certs.private_key } : {}) 
      } : {}),
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
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full h-full overflow-y-auto space-y-6 scrollbar-thin animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-forge-text tracking-tight">
            Rede & Conectividade
          </h2>
          <p className="text-xs sm:text-sm text-forge-text-secondary mt-0.5">
            Gerencie o Ponto de Acesso AP integrado e conecte-se a redes Wi-Fi institucionais.
          </p>
        </div>
        <button
          onClick={() => fetchScan()}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-forge-surface hover:bg-forge-surface-2 text-forge-text rounded-lg text-xs font-medium transition-colors border border-forge-border self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-forge-primary" />
          <span>Escanear Redes</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provisioning Form */}
        <div className="forge-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4 border-b border-forge-border pb-3">
              <Radio className="w-5 h-5 text-forge-primary" />
              <h3 className="font-semibold text-base text-forge-text">Configuração Wi-Fi (Client & AP)</h3>
            </div>

            {/* Discovered networks with search bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-forge-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-forge-primary" />
                  Redes nas Proximidades ({filteredNetworks.length})
                </label>
                {wifiNetworks.length > 0 && (
                  <span className="text-[10px] text-forge-text-muted font-mono">
                    Total: {wifiNetworks.length}
                  </span>
                )}
              </div>

              {/* Dynamic search input */}
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-forge-text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filtrar redes por nome ou tipo..."
                  className="w-full bg-forge-surface-2 border border-forge-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-forge-text placeholder-forge-text-muted focus:outline-none focus:border-forge-primary transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-forge-text-muted hover:text-forge-text p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {filteredNetworks.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-forge-surface-2 rounded-lg border border-forge-border scrollbar-thin">
                  {filteredNetworks.map((n) => (
                    <button
                      key={n.ssid}
                      type="button"
                      onClick={() => handleSelectNetwork(n.ssid, n.encryption)}
                      className={`text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 transition-all ${
                        ssid === n.ssid
                          ? 'bg-forge-primary text-forge-bg font-semibold shadow-sm'
                          : 'bg-forge-surface hover:bg-forge-surface-3 text-forge-text border border-forge-border'
                      }`}
                    >
                      <Wifi className={`w-3 h-3 ${
                        (n.rssi || -70) >= -60 ? 'text-emerald-400' :
                        (n.rssi || -70) >= -75 ? 'text-amber-400' : 'text-forge-text-muted'
                      }`} />
                      <span className="font-medium">{n.ssid}</span>
                      <span className="text-[10px] font-mono uppercase opacity-75">
                        {n.encryption}
                      </span>
                      {n.rssi && (
                        <span className="text-[10px] opacity-75 font-mono">
                          {n.rssi}dBm
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center bg-forge-surface-2 rounded-lg border border-forge-border text-xs text-forge-text-muted">
                  {searchTerm ? `Nenhuma rede encontrada para "${searchTerm}"` : 'Nenhuma rede detectada no momento.'}
                </div>
              )}
            </div>
            
            <form onSubmit={handleConnect} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">
                  SSID (Nome da Rede)
                </label>
                <input 
                  type="text" 
                  required
                  value={ssid}
                  onChange={e => setSsid(e.target.value)}
                  placeholder="Nome da sua rede Wi-Fi"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">
                  Segurança
                </label>
                <select 
                  aria-label="Segurança" 
                  className={fieldClass} 
                  value={security} 
                  onChange={e => setSecurity(e.target.value as WifiProvision['type'])}
                >
                  <option value="psk">WPA / WPA2 Pessoal</option>
                  <option value="sae">WPA3 Pessoal (SAE)</option>
                  <option value="open">Aberta (sem senha)</option>
                  <option value="owe">Aberta aprimorada (OWE)</option>
                  <option value="eap">Empresarial / 802.1X (eduroam / UNESP)</option>
                </select>
              </div>

              {isEap && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Método EAP</label>
                    <select className={fieldClass} value={method} onChange={e => { setMethod(e.target.value as NonNullable<WifiProvision['method']>); setPhase2('MSCHAPV2'); }}>
                      <option>PEAP</option><option>TTLS</option><option>PWD</option><option>TLS</option>
                    </select>
                  </div>
                  {(method === 'PEAP' || method === 'TTLS') && (
                    <div>
                      <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Autenticação Interna</label>
                      <select className={fieldClass} value={phase2} onChange={e => setPhase2(e.target.value)}>
                        <option>MSCHAPV2</option><option>GTC</option>{method === 'TTLS' && <option>PAP</option>}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Identidade / Usuário</label>
                    <input required className={fieldClass} value={identity} onChange={e => setIdentity(e.target.value)} placeholder="usuario@unesp.br" autoComplete="username" />
                  </div>
                  {method !== 'PWD' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Domínio de Autenticação (vazio = sem validação)</label>
                        <input className={fieldClass} value={domain} onChange={e => setDomain(e.target.value)} placeholder="unesp.br" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Certificado CA (.pem opcional)</label>
                        <input key={`ca-${certificateReset}`} type="file" accept=".pem,.crt,.cer" className={fieldClass} onChange={e => void readCertificate('ca_cert', e.target.files?.[0])} />
                      </div>
                    </>
                  )}
                  {(method === 'PEAP' || method === 'TTLS') && (
                    <div>
                      <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Identidade Anônima (Opcional)</label>
                      <input className={fieldClass} value={anonymousIdentity} onChange={e => setAnonymousIdentity(e.target.value)} placeholder="anonymous@unesp.br" />
                    </div>
                  )}
                  {method === 'TLS' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Certificado do Cliente (.pem)</label>
                        <input key={`cert-${certificateReset}`} required type="file" accept=".pem,.crt" className={fieldClass} onChange={e => void readCertificate('client_cert', e.target.files?.[0])} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Chave Privada do Cliente (.pem)</label>
                        <input key={`key-${certificateReset}`} required type="file" accept=".pem,.key" className={fieldClass} onChange={e => void readCertificate('private_key', e.target.files?.[0])} />
                      </div>
                    </>
                  )}
                </>
              )}

              {(security === 'psk' || security === 'sae' || (isEap && method !== 'TLS')) && (
                <div>
                  <label className="block text-xs font-semibold text-forge-text-secondary uppercase mb-1">Senha</label>
                  <input type="password" required className={fieldClass} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                </div>
              )}

              {isEap && Object.values(fileErrors).some(Boolean) && (
                <p role="alert" className="text-xs text-rose-400">{Object.values(fileErrors).filter(Boolean).join(' ')}</p>
              )}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-2.5 text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>Ao conectar, o ponto de acesso será mantido ativo para contingência.</p>
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
                className="mt-2 w-full bg-forge-primary hover:bg-forge-primary-hover disabled:opacity-50 text-forge-bg py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex justify-center items-center gap-2 shadow"
              >
                {connecting || awaitingConnection ? 'Aguardando conexão...' : <><Wifi className="w-4 h-4" /> Salvar e Conectar</>}
              </button>
            </form>
          </div>

          <div className="pt-4 mt-4 border-t border-forge-border">
            <button
              onClick={() => resetWifi()}
              className="text-xs text-forge-text-muted hover:text-rose-400 underline transition-colors"
            >
              Forçar reinicialização para Ponto de Acesso (AP Mode)
            </button>
          </div>
        </div>

        {/* HDMI Framebuffer & QR Code Pairing */}
        <div className="forge-card p-6 flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-white rounded-2xl mb-4 shadow-xl">
            <QrCode className="w-44 h-44 text-slate-950" />
          </div>
          <h3 className="font-bold text-lg mb-2 text-forge-text">Ponte Kiosk HDMI (/dev/fb0)</h3>
          <p className="text-xs text-forge-text-secondary mb-4 max-w-xs leading-relaxed">
            O Kiosk exibe este QR Code diretamente na TV com resolução 1080p e proteção anti-burnin por pixel-shift sinusoidal (±2px).
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-forge-surface-2 rounded-full border border-forge-border text-xs font-mono text-forge-primary">
            <span>http://{window.location.host || '192.168.4.1:8080'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

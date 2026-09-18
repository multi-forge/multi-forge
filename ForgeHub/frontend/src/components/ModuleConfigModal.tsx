import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Monitor,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Cpu,
  RotateCcw,
  Check,
  Copy,
  Play,
  Save,
  HelpCircle,
  Maximize2,
  Minimize2,
  Compass
} from 'lucide-react';
import { useStore } from '../store/useStore';

export interface ModuleRuntimeConfig {
  windowMode: 'windowed_frame' | 'windowed_borderless' | 'fullscreen';
  rotation: 'none' | 'right' | 'left';
  studioMode: boolean;
  offlineMode: boolean;
  llmProvider: 'cerebras' | 'groq' | 'gemini';
  activeSemester: 'auto' | '2026/1' | '2026/2';
  ttsEnabled: boolean;
  ttsVoice: 'pt-BR-FranciscaNeural' | 'pt-BR-AntonioNeural' | 'pt-BR-ThalitaNeural';
  ttsRate: string;
  sttEnabled: boolean;
}

const DEFAULT_CONFIG: ModuleRuntimeConfig = {
  windowMode: 'windowed_frame',
  rotation: 'none',
  studioMode: false,
  offlineMode: true,
  llmProvider: 'cerebras',
  activeSemester: 'auto',
  ttsEnabled: false,
  ttsVoice: 'pt-BR-FranciscaNeural',
  ttsRate: '+15%',
  sttEnabled: false,
};

interface ModuleConfigModalProps {
  isOpen: boolean;
  moduleId: string | null;
  onClose: () => void;
  onStart?: (id: string) => void;
}

export const ModuleConfigModal: React.FC<ModuleConfigModalProps> = ({
  isOpen,
  moduleId,
  onClose,
  onStart,
}) => {
  const { modules } = useStore();
  const module = modules.find((m) => m.id === moduleId);

  const [config, setConfig] = useState<ModuleRuntimeConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<'display' | 'ai' | 'audio'>('display');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!moduleId || !isOpen) return;
    try {
      const stored = localStorage.getItem(`forge_config_${moduleId}`);
      if (stored) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
  }, [moduleId, isOpen]);

  if (!isOpen || !moduleId) return null;

  const buildCommand = (): string => {
    const parts = ['python', 'main_gui.py'];

    if (config.windowMode === 'windowed_frame') {
      parts.push('-w', '--frame');
    } else if (config.windowMode === 'windowed_borderless') {
      parts.push('-w');
    } else if (config.windowMode === 'fullscreen') {
      parts.push('-f');
    }

    if (config.rotation === 'right') {
      parts.push('-r right');
    } else if (config.rotation === 'left') {
      parts.push('-r left');
    }

    if (config.studioMode) {
      parts.push('-s');
    }

    if (config.offlineMode) {
      parts.push('--offline');
    }

    if (!config.ttsEnabled) {
      parts.push('--no-tts');
    }

    if (!config.sttEnabled) {
      parts.push('--no-stt');
    }

    return parts.join(' ');
  };

  const commandString = buildCommand();

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(commandString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    localStorage.setItem(`forge_config_${moduleId}`, JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem(`forge_config_${moduleId}`);
  };

  const handleLaunch = () => {
    handleSave();
    if (onStart && moduleId) {
      onStart(moduleId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-forge-surface border border-forge-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-forge-border bg-forge-bg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-forge-primary/10 border border-forge-primary/20 text-forge-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-forge-text flex items-center gap-2">
                Parâmetros de Execução
              </h3>
              <p className="text-xs text-forge-text-muted font-mono">
                {module?.name || moduleId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-forge-text-secondary hover:text-forge-text p-1.5 rounded-lg hover:bg-forge-surface-2 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-forge-border bg-forge-surface-2/60 px-6 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('display')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'display'
                ? 'border-forge-primary text-forge-primary font-semibold'
                : 'border-transparent text-forge-text-secondary hover:text-forge-text'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Display & Janela
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'ai'
                ? 'border-forge-primary text-forge-primary font-semibold'
                : 'border-transparent text-forge-text-secondary hover:text-forge-text'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> IA & Dados UNESP
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audio'
                ? 'border-forge-primary text-forge-primary font-semibold'
                : 'border-transparent text-forge-text-secondary hover:text-forge-text'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" /> Áudio & Voz (TTS/STT)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* TAB 1: Display & Janela */}
          {activeTab === 'display' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-forge-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-forge-primary" /> Modo da Janela Gráfica
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, windowMode: 'windowed_frame' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      config.windowMode === 'windowed_frame'
                        ? 'bg-forge-primary/10 border-forge-primary text-forge-text shadow-sm'
                        : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:bg-forge-surface-3 hover:text-forge-text'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">Com Moldura</span>
                      <Minimize2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] text-forge-text-muted leading-snug">
                      Barra de título do SO e botões padrão.
                    </span>
                    <span className="text-[10px] font-mono text-forge-primary mt-2">-w --frame</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, windowMode: 'windowed_borderless' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      config.windowMode === 'windowed_borderless'
                        ? 'bg-forge-primary/10 border-forge-primary text-forge-text shadow-sm'
                        : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:bg-forge-surface-3 hover:text-forge-text'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">Sem Bordas</span>
                      <Monitor className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] text-forge-text-muted leading-snug">
                      Estilo totem/kiosk sem barra de título.
                    </span>
                    <span className="text-[10px] font-mono text-forge-primary mt-2">-w</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, windowMode: 'fullscreen' })}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      config.windowMode === 'fullscreen'
                        ? 'bg-forge-primary/10 border-forge-primary text-forge-text shadow-sm'
                        : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:bg-forge-surface-3 hover:text-forge-text'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">Tela Cheia</span>
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] text-forge-text-muted leading-snug">
                      Ocupa 100% da tela para quiosques públicos.
                    </span>
                    <span className="text-[10px] font-mono text-forge-primary mt-2">-f</span>
                  </button>
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs font-semibold text-forge-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-forge-primary" /> Rotação de Display
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, rotation: 'none' })}
                    className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-medium ${
                      config.rotation === 'none'
                        ? 'bg-forge-primary/10 border-forge-primary text-forge-primary'
                        : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:bg-forge-surface-3'
                    }`}
                  >
                    Padrão (0°)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, rotation: 'right' })}
                    className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-medium ${
                      config.rotation === 'right'
                        ? 'bg-forge-primary/10 border-forge-primary text-forge-primary'
                        : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:bg-forge-surface-3'
                    }`}
                  >
                    90° Horário
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, rotation: 'left' })}
                    className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-medium ${
                      config.rotation === 'left'
                        ? 'bg-forge-primary/10 border-forge-primary text-forge-primary'
                        : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:bg-forge-surface-3'
                    }`}
                  >
                    90° Anti-horário
                  </button>
                </div>
              </div>

              {/* Studio Mode */}
              <div className="bg-forge-surface-2 border border-forge-border rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-forge-text flex items-center gap-1.5">
                    Modo Studio / Editor Visual <span className="font-mono text-[10px] text-forge-primary">(-s)</span>
                  </h4>
                  <p className="text-[11px] text-forge-text-muted">
                    Barra lateral para ajuste de layouts e temas em tempo real.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.studioMode}
                    onChange={(e) => setConfig({ ...config, studioMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-forge-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forge-primary"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: IA & Dados UNESP */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="bg-forge-surface-2 border border-forge-border rounded-xl p-4 flex items-center justify-between">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-semibold text-forge-text">
                      Modo 100% Offline (SQLite FTS5 Local)
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-forge-text-muted leading-relaxed">
                    Responde instantaneamente consultas de horários, docentes, salas e cardápio da UNESP com latência &lt;4ms.
                  </p>
                  <span className="inline-block font-mono text-[10px] text-forge-primary mt-2">--offline</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.offlineMode}
                    onChange={(e) => setConfig({ ...config, offlineMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-forge-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forge-primary"></div>
                </label>
              </div>

              {!config.offlineMode && (
                <div className="p-4 rounded-xl bg-forge-surface-2 border border-forge-border space-y-3">
                  <label className="block text-xs font-semibold text-forge-text-secondary uppercase tracking-wider">
                    Provedor de LLM em Nuvem
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cerebras', label: 'Cerebras Fast' },
                      { id: 'groq', label: 'Groq Llama 3.3' },
                      { id: 'gemini', label: 'Google Gemini' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setConfig({ ...config, llmProvider: p.id as any })}
                        className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-medium ${
                          config.llmProvider === p.id
                            ? 'bg-forge-primary text-forge-bg font-bold border-forge-primary'
                            : 'bg-forge-surface border-forge-border text-forge-text-secondary hover:text-forge-text'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forge-text-secondary uppercase tracking-wider mb-2">
                  Semestre Acadêmico Ativo
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'auto', label: 'Automático' },
                    { id: '2026/1', label: '1º Semestre 2026' },
                    { id: '2026/2', label: '2º Semestre 2026' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setConfig({ ...config, activeSemester: s.id as any })}
                      className={`py-2 px-3 rounded-lg border text-center transition-all text-xs font-medium ${
                        config.activeSemester === s.id
                          ? 'bg-forge-primary/10 border-forge-primary text-forge-primary'
                          : 'bg-forge-surface-2 border-forge-border text-forge-text-secondary hover:text-forge-text'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Áudio & Voz */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div className="bg-forge-surface-2 border border-forge-border rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-forge-text flex items-center gap-1.5">
                    {config.ttsEnabled ? <Volume2 className="w-4 h-4 text-forge-primary" /> : <VolumeX className="w-4 h-4 text-forge-text-muted" />}
                    Síntese de Voz (TTS)
                  </h4>
                  <p className="text-[11px] text-forge-text-muted">
                    {config.ttsEnabled ? 'Respostas em voz ativa.' : 'Silencioso para economia de CPU/RAM.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.ttsEnabled}
                    onChange={(e) => setConfig({ ...config, ttsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-forge-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forge-primary"></div>
                </label>
              </div>

              <div className="bg-forge-surface-2 border border-forge-border rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-forge-text flex items-center gap-1.5">
                    {config.sttEnabled ? <Mic className="w-4 h-4 text-forge-primary" /> : <MicOff className="w-4 h-4 text-forge-text-muted" />}
                    Reconhecimento de Fala (STT)
                  </h4>
                  <p className="text-[11px] text-forge-text-muted">
                    {config.sttEnabled ? 'Microfone ativo para wake-word "Mina".' : 'Desativado para operação por toque.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.sttEnabled}
                    onChange={(e) => setConfig({ ...config, sttEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-forge-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-forge-primary"></div>
                </label>
              </div>
            </div>
          )}

          {/* Command String Output */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs font-medium text-forge-text-secondary mb-1.5">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-forge-primary" /> Linha de Execução Dinâmica
              </span>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="text-forge-text-secondary hover:text-forge-primary flex items-center gap-1 text-[11px] transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="bg-forge-bg border border-forge-border rounded-xl p-3 font-mono text-xs text-forge-primary break-all select-all flex items-center justify-between shadow-inner">
              <span>{commandString}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-forge-border bg-forge-bg flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-forge-text-muted hover:text-forge-text flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-forge-surface-2 hover:bg-forge-surface-3 text-forge-text border border-forge-border flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Salvo!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Salvar Preferências
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLaunch}
              className="px-4 py-2 rounded-xl bg-forge-primary hover:bg-forge-primary-hover text-forge-bg flex items-center gap-1.5 text-xs font-bold shadow-md transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Iniciar Módulo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

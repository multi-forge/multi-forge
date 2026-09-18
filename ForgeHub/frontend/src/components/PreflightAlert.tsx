import React from 'react';
import { useStore } from '../store/useStore';
import { AlertOctagon } from 'lucide-react';

export const PreflightAlert: React.FC = () => {
  const { telemetry } = useStore();
  
  const availableRam = telemetry.ramTotal - telemetry.ram;
  
  if (availableRam >= 300) return null;

  return (
    <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-center gap-3 text-rose-400 text-xs sm:text-sm">
      <AlertOctagon className="w-4 h-4 shrink-0" />
      <span className="font-semibold">Aviso Crítico de Memória:</span>
      <span>Menos de 300MB de RAM disponíveis. A instalação ou execução de novos módulos pode instabilizar o sistema.</span>
    </div>
  );
};

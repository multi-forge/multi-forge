import React from 'react';
import { useStore } from '../store/useStore';
import { AlertOctagon } from 'lucide-react';

export const PreflightAlert: React.FC = () => {
  const { telemetry } = useStore();
  
  const availableRam = telemetry.ramTotal - telemetry.ram;
  
  if (availableRam >= 300) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-3 text-red-500 text-sm">
      <AlertOctagon className="w-4 h-4" />
      <span className="font-medium">Critical Memory Warning:</span>
      <span>Less than 300MB RAM available. Installing new modules may cause system instability.</span>
    </div>
  );
};

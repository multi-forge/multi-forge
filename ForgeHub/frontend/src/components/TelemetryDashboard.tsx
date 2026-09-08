import React from 'react';
import { useStore } from '../store/useStore';
import { Cpu, MemoryStick, Thermometer, HardDrive, Network } from 'lucide-react';

const GaugeCard = ({ title, icon: Icon, value, max, unit, format = (v: number) => v.toFixed(1) }: any) => {
  const percentage = max ? (value / max) * 100 : 0;
  return (
    <div className="bg-slate-850 border border-slate-800 p-5 rounded-xl shadow-sm">
      <div className="flex items-center gap-3 mb-4 text-slate-400">
        <Icon className="w-5 h-5" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <span className="text-3xl font-light text-white">{format(value)}<span className="text-lg text-slate-500 ml-1">{unit}</span></span>
          {max && <span className="text-sm text-slate-500 font-mono">{format(max)} {unit}</span>}
        </div>
        {max && (
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${percentage > 85 ? 'bg-red-500' : percentage > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const TelemetryDashboard: React.FC = () => {
  const { telemetry } = useStore();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-6">System Telemetry</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <GaugeCard title="CPU Usage" icon={Cpu} value={telemetry.cpu} max={100} unit="%" />
        <GaugeCard title="Memory" icon={MemoryStick} value={telemetry.ram} max={telemetry.ramTotal} unit="MB" format={(v: number) => v.toFixed(0)} />
        <GaugeCard title="Temperature" icon={Thermometer} value={telemetry.temp} unit="°C" max={100} />
        <GaugeCard title="Disk Storage" icon={HardDrive} value={telemetry.disk} max={telemetry.diskTotal} unit="GB" format={(v: number) => v.toFixed(0)} />
        <div className="bg-slate-850 border border-slate-800 p-5 rounded-xl shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-4 text-slate-400">
            <Network className="w-5 h-5" />
            <h3 className="font-medium">Network I/O</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-500 mb-1">RX (Down)</div>
              <div className="text-xl font-light text-white">{telemetry.netRx.toFixed(0)} <span className="text-xs text-slate-500">KB/s</span></div>
            </div>
            <div>
              <div className="text-sm text-slate-500 mb-1">TX (Up)</div>
              <div className="text-xl font-light text-white">{telemetry.netTx.toFixed(0)} <span className="text-xs text-slate-500">KB/s</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

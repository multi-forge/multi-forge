import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Download, Search } from 'lucide-react';

export const StoreView: React.FC = () => {
  const { modules, installModule, telemetry } = useStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | 'AI' | 'Data' | 'Utilities' | 'Media'>('All');

  const availableRam = telemetry.ramTotal - telemetry.ram;
  const filteredModules = modules.filter(m => 
    (!m.installed) &&
    (category === 'All' || m.category === category) &&
    (m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleInstall = (id: string, req: number) => {
    if (availableRam < 300 || req > availableRam) {
      if(!window.confirm(`Warning: Installing this module might cause memory issues. You have ${availableRam.toFixed(0)}MB free. Continue?`)) {
        return;
      }
    }
    installModule(id);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold">Module Store</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search modules..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {['All', 'AI', 'Data', 'Utilities', 'Media'].map(c => (
          <button 
            key={c}
            onClick={() => setCategory(c as any)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${category === c ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredModules.map(m => (
          <div key={m.id} className="bg-slate-850 border border-slate-800 rounded-xl p-5 flex flex-col hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-lg">{m.name}</h3>
              <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">{m.category}</span>
            </div>
            <p className="text-sm text-slate-400 flex-1 mb-4">{m.description}</p>
            <div className="flex items-center gap-2 mb-4 text-xs font-mono text-slate-500">
              <span className={m.ramReq > availableRam ? 'text-amber-500' : ''}>RAM: {m.ramReq}MB</span>
              <span>CPU: {m.cpuReq}%</span>
            </div>
            <button 
              onClick={() => handleInstall(m.id, m.ramReq)}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Install
            </button>
          </div>
        ))}
        {filteredModules.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No modules found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};

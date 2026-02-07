
import React, { useState, useRef, useEffect } from 'react';
import { Room, MaterialItem, RenderRequest, RenderResult, BuildingMap, LibraryItem, RenderType } from './types';
import { ArchitecturalService } from './services/gemini';
import { 
  DocumentPlusIcon, SparklesIcon, MapIcon, ShieldCheckIcon, ArrowDownTrayIcon,
  CommandLineIcon, WrenchScrewdriverIcon, Square3Stack3DIcon, ScaleIcon,
  ExclamationTriangleIcon, ArrowRightIcon, PlusIcon, TrashIcon, DocumentTextIcon,
  CheckCircleIcon, BeakerIcon, AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

const AXIOM_ROOMS: {id: string, name: string, level: number}[] = [
  { id: '200', name: 'Living Room 200 (Hero Space — Vaulted)', level: 2 },
  { id: '201', name: 'Kitchenette 201', level: 2 },
  { id: '202', name: 'Bedroom 202 (East)', level: 2 },
  { id: '206', name: 'Bedroom 206 (Northeast)', level: 2 },
  { id: '204', name: 'Bathroom 204', level: 2 },
  { id: '208', name: 'Utility / Entry 208', level: 2 },
  { id: 'G1', name: 'Garage Bay (3-Car)', level: 1 },
  { id: 'G2', name: 'Workshop / Shop Bay', level: 1 },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'blueprints' | 'map' | 'visualizer'>('library');
  const [files, setFiles] = useState<{name: string, data: string, mimeType: string}[]>([]);
  const [buildingMap, setBuildingMap] = useState<BuildingMap | null>(null);
  const [renders, setRenders] = useState<RenderResult[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([
    { id: 'a1', title: 'System-Prompt.md', category: 'A', content: '# CORE CONSTITUTION\nPaste Cardinal Axioms here.', isActive: true },
    { id: 'a2', title: 'Known-Hallucinations.md', category: 'A', content: '# FAILURE CATALOG\nAvoid drive-through garages.', isActive: true },
    { id: 'b1', title: '01: Exterior Massing', category: 'B', content: 'Generate white-clay exterior {DIRECTION} isometric view.', isActive: true },
    { id: 'b2', title: '02: Axiom Audit', category: 'B', content: 'Verify image against axioms. Return PASS/FAIL.', isActive: true },
    { id: 'b3', title: '03: Plan View', category: 'B', content: 'Generate top-down floor plan view.', isActive: true },
    { id: 'b4', title: '04: Interior Room', category: 'B', content: 'Generate interior perspective of {ROOM_NAME}.', isActive: true },
    { id: 'b7', title: '07: Scoring Rubric', category: 'B', content: 'Score output 1-10 on Structural Accuracy.', isActive: true }
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const [renderType, setRenderType] = useState<RenderType>('exterior_iso');
  const [viewpoint, setViewpoint] = useState('SE');
  const [targetRoomId, setTargetRoomId] = useState<string>('');

  const service = useRef(new ArchitecturalService());

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    Array.from(fileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFiles(prev => [...prev, { 
          name: file.name, 
          data: ev.target?.result as string,
          mimeType: file.type || 'image/jpeg'
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const runDiligence = async () => {
    setIsBusy(true);
    setStatusMessage("PERFORMING CONFORMITY AUDIT...");
    try {
      const result = await service.current.rationalizePlan(files.map(f => ({ data: f.data, mimeType: f.mimeType })), library);
      setBuildingMap(result.map);
      setActiveTab('map');
    } catch (err: any) {
      alert("Audit Failed: " + err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const triggerPipeline = async () => {
    setIsBusy(true);
    setStatusMessage("INITIALIZING RENDER PIPELINE...");
    try {
      const result = await service.current.executeRenderPipeline({
        type: renderType,
        viewpoint,
        targetRoomId: targetRoomId || undefined
      }, library, (buildingMap?.rooms || AXIOM_ROOMS).find(r => r.id === targetRoomId), (msg) => {
        setStatusMessage(msg);
      });
      setRenders(prev => [result, ...prev]);
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        return;
      }
      alert("Pipeline Error: " + err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const addLibraryItem = (category: 'A' | 'B') => {
    const newItem: LibraryItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: category === 'A' ? 'New Axiom' : 'New Workflow',
      content: '# Content here',
      category,
      isActive: true
    };
    setLibrary([...library, newItem]);
    setEditingId(newItem.id);
  };

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-white border-2 border-slate-900 p-12 max-w-md w-full shadow-2xl text-center space-y-8">
          <ShieldCheckIcon className="w-16 h-16 text-slate-900 mx-auto" />
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">API Key Required</h2>
          <p className="text-slate-500 text-xs font-mono uppercase leading-relaxed">Gemini 3 Pro features require a paid API key from a billing-enabled project.</p>
          <button onClick={handleSelectKey} className="w-full bg-slate-900 text-white py-4 font-black uppercase tracking-widest text-xs hover:bg-black transition-all">Select API Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="bg-white border-b-2 border-slate-900 flex flex-col lg:flex-row shadow-sm sticky top-0 z-50">
        <div className="border-r-2 border-slate-900 p-6 flex items-center gap-4 bg-slate-900 text-white min-w-[320px]">
          <ShieldCheckIcon className="w-10 h-10 text-blueprint-500" />
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">Axiom Engine</h1>
            <p className="text-[10px] font-mono tracking-widest opacity-60 mt-1 uppercase">Structural Integrity Lab</p>
          </div>
        </div>
        
        <div className="flex-grow flex flex-col sm:flex-row justify-between items-center px-8 gap-4 py-4 lg:py-0">
          <nav className="flex bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'library', label: '0. Axiom Library', icon: ScaleIcon },
              { id: 'blueprints', label: '1. Ingest/Audit', icon: DocumentPlusIcon },
              { id: 'map', label: '2. Field Map', icon: MapIcon },
              { id: 'visualizer', label: '3. Visualize', icon: SparklesIcon }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-md text-[11px] font-black tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-col text-right">
             <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Active Sheet</span>
             <span className="text-sm font-black uppercase text-slate-900">{activeTab.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {isBusy && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white border-2 border-slate-900 p-1 max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="p-12 text-center space-y-6">
               <div className="w-full h-1.5 bg-slate-100 relative overflow-hidden">
                 <div className="absolute inset-0 bg-slate-900 animate-progress origin-left"></div>
               </div>
               <p className="text-slate-900 font-mono text-[10px] font-black uppercase tracking-widest animate-pulse">&gt; {statusMessage}</p>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow p-8 max-w-[1600px] mx-auto w-full">
        {activeTab === 'library' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white border-2 border-slate-900 p-6 shadow-md">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Core Constitution (A)</h3>
                  <button onClick={() => addLibraryItem('A')} className="p-1 hover:bg-slate-100 rounded"><PlusIcon className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  {library.filter(i => i.category === 'A').map(item => (
                    <div key={item.id} onClick={() => setEditingId(item.id)} className={`p-3 border-2 cursor-pointer flex justify-between items-center ${editingId === item.id ? 'border-slate-900 bg-slate-50' : 'border-slate-50 hover:bg-slate-50'}`}>
                      <span className="text-[10px] font-black uppercase tracking-tight">{item.title}</span>
                      <input type="checkbox" checked={item.isActive} readOnly className="accent-slate-900" />
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-white border-2 border-slate-900 p-6 shadow-md">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Workflows (B)</h3>
                  <button onClick={() => addLibraryItem('B')} className="p-1 hover:bg-slate-100 rounded"><PlusIcon className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  {library.filter(i => i.category === 'B').map(item => (
                    <div key={item.id} onClick={() => setEditingId(item.id)} className={`p-3 border-2 cursor-pointer flex justify-between items-center ${editingId === item.id ? 'border-slate-900 bg-slate-50' : 'border-slate-50 hover:bg-slate-50'}`}>
                      <span className="text-[10px] font-black uppercase tracking-tight">{item.title}</span>
                      <input type="checkbox" checked={item.isActive} readOnly className="accent-slate-900" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="lg:col-span-8">
              {editingId ? (
                <div className="bg-white border-2 border-slate-900 h-[700px] flex flex-col shadow-2xl">
                   <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                     <input className="bg-transparent font-black uppercase text-sm tracking-widest outline-none w-full" value={library.find(i => i.id === editingId)?.title} onChange={(e) => setLibrary(library.map(i => i.id === editingId ? {...i, title: e.target.value} : i))} />
                     <button onClick={() => { setLibrary(library.filter(i => i.id !== editingId)); setEditingId(null); }} className="text-red-400 p-1"><TrashIcon className="w-4 h-4" /></button>
                   </div>
                   <textarea className="flex-grow p-10 font-mono text-xs text-slate-600 outline-none leading-relaxed resize-none" value={library.find(i => i.id === editingId)?.content} onChange={(e) => setLibrary(library.map(i => i.id === editingId ? {...i, content: e.target.value} : i))} />
                </div>
              ) : (
                <div className="h-[700px] border-4 border-dashed border-slate-200 flex items-center justify-center text-slate-300">Constitutional Editor Ready</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'visualizer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white border-2 border-slate-900 shadow-2xl sticky top-28">
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase">Render_Controller</span>
                  <AdjustmentsHorizontalIcon className="w-4 h-4" />
                </div>
                <div className="p-8 space-y-6">
                   <div className="space-y-1.5">
                    <label className="text-[9px] font-mono font-black text-slate-400 uppercase">Render Type</label>
                    <select value={renderType} onChange={(e) => setRenderType(e.target.value as any)} className="w-full p-4 border border-slate-200 bg-slate-50 font-black text-xs uppercase text-slate-700 outline-none">
                      <option value="exterior_iso">Exterior Shell — Isometric</option>
                      <option value="exterior_elev">Exterior Shell — Elevation</option>
                      <option value="interior_plan">Interior — Plan View</option>
                      <option value="interior_persp">Interior — Room Perspective</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono font-black text-slate-400 uppercase">Viewpoint Context</label>
                    {renderType.startsWith('exterior') ? (
                       <div className="grid grid-cols-2 gap-2">
                         {(renderType === 'exterior_iso' ? ['SE', 'SW', 'NE', 'NW'] : ['East (Alley)', 'West (House)', 'North', 'South (Stairs)']).map(v => (
                           <button key={v} onClick={() => setViewpoint(v)} className={`p-3 border-2 font-black text-xs ${viewpoint === v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100'}`}>{v}</button>
                         ))}
                       </div>
                    ) : (
                      <select className="w-full p-4 border border-slate-200 bg-slate-50 font-black text-xs uppercase" value={targetRoomId} onChange={(e) => setTargetRoomId(e.target.value)}>
                        <option value="">Select Room Target...</option>
                        {(buildingMap?.rooms || AXIOM_ROOMS).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                  </div>
                  <button onClick={triggerPipeline} disabled={isBusy} className="w-full bg-slate-900 text-white py-5 font-black uppercase text-xs flex items-center justify-center gap-3 active:scale-95">
                    <SparklesIcon className="w-5 h-5" /> Generate + Validate
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-16">
               {renders.length === 0 ? (
                 <div className="h-[700px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <Square3Stack3DIcon className="w-20 h-20 opacity-20" />
                    <p className="font-mono uppercase tracking-[0.5em] text-[10px] mt-8">Pipeline_Idle</p>
                 </div>
               ) : (
                 <div className="space-y-20 pb-20">
                   {renders.map(render => (
                     <div key={render.id} className="bg-white border-2 border-slate-900 p-1 shadow-2xl">
                        <div className={`p-4 text-white flex justify-between items-center ${render.status === 'VERIFIED' ? 'bg-green-600' : 'bg-red-600'}`}>
                          <div className="flex items-center gap-3">
                            {render.status === 'VERIFIED' ? <ShieldCheckIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
                            <span className="text-[10px] font-mono font-black uppercase">AXIOM_STATUS: {render.status}</span>
                          </div>
                          <span className="text-[8px] font-mono opacity-60 uppercase">{new Date(render.timestamp).toLocaleTimeString()}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 xl:grid-cols-12">
                          <div className="xl:col-span-8 bg-slate-100">
                            <img src={render.imageUrl} className="w-full h-full object-cover" alt="Render" />
                          </div>
                          <div className="xl:col-span-4 bg-slate-50 border-l border-slate-200 p-6 space-y-6">
                             {/* Score Badge */}
                             {render.auditScore && (
                               <div className="mb-4 p-3 bg-white border border-slate-200">
                                 <div className="flex justify-between items-center mb-2">
                                   <span className="text-[10px] font-black uppercase">Total Score</span>
                                   <span className={`text-lg font-black ${render.auditScore.total >= 42 ? 'text-green-600' : 'text-red-600'}`}>
                                     {render.auditScore.total}/60
                                   </span>
                                 </div>
                                 <div className="grid grid-cols-3 gap-1">
                                   {Object.entries(render.auditScore).filter(([k]) => k !== 'total').map(([key, val]) => (
                                     <div key={key} className={`p-1.5 text-center ${(val as number) >= 7 ? 'bg-green-50' : 'bg-red-50'}`}>
                                       <div className="text-[7px] font-black uppercase text-slate-400">{key.replace('_', ' ')}</div>
                                       <div className={`text-xs font-black ${(val as number) >= 7 ? 'text-green-700' : 'text-red-700'}`}>{val as number}/10</div>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}

                             {/* Failure List */}
                             {render.auditFailures && render.auditFailures.length > 0 && (
                               <div className="mb-4 space-y-1">
                                 <h4 className="text-[10px] font-black uppercase text-red-600 mb-2">Axiom Violations</h4>
                                 {render.auditFailures.map((f, i) => (
                                   <div key={i} className="p-2 bg-red-50 border-l-2 border-red-500">
                                     <div className="text-[9px] font-black uppercase text-red-700">{f.category}</div>
                                     <div className="text-[8px] text-red-600 leading-tight">{f.description}</div>
                                     <div className="text-[7px] text-slate-500 italic mt-1">Fix: {f.axiom_correction}</div>
                                   </div>
                                 ))}
                               </div>
                             )}

                             <div className="font-mono text-[9px] text-slate-600 leading-relaxed max-h-[200px] overflow-y-auto">
                               {render.auditText}
                             </div>
                          </div>
                        </div>

                        <div className="p-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                           <div className="space-y-1">
                             <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{render.request.type.replace('_', ' ')}: {render.request.viewpoint}</h4>
                             <p className="text-[9px] text-slate-400 font-mono uppercase">2-Stage Validated Render Pipeline</p>
                           </div>
                           <div className="flex gap-3">
                             {render.status === 'VIOLATION' && (
                               <button 
                                 onClick={async () => {
                                   setIsBusy(true);
                                   setStatusMessage("STAGE 3: AUTO-REFINING RENDER...");
                                   try {
                                     const refined = await service.current.executeRefinement(
                                       render,
                                       render.request,
                                       library,
                                       (buildingMap?.rooms || AXIOM_ROOMS).find(r => r.id === render.request.targetRoomId),
                                       (msg) => setStatusMessage(msg)
                                     );
                                     setRenders(prev => [refined, ...prev]);
                                   } catch (err: any) {
                                     alert("Refinement Error: " + err.message);
                                   } finally {
                                     setIsBusy(false);
                                   }
                                 }}
                                 className="bg-slate-900 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2"
                               >
                                 <WrenchScrewdriverIcon className="w-4 h-4" />
                                 Auto-Refine Render
                               </button>
                             )}
                             <button 
                               onClick={() => {
                                 const link = document.createElement('a');
                                 link.href = render.imageUrl;
                                 link.download = `axiom-render-${render.request.type}-${render.request.viewpoint}-${render.id}.png`;
                                 document.body.appendChild(link);
                                 link.click();
                                 document.body.removeChild(link);
                               }}
                               className="bg-white border border-slate-900 text-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                             >
                               <ArrowDownTrayIcon className="w-4 h-4" />
                               Export Image
                             </button>
                           </div>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'blueprints' && (
           <div className="max-w-4xl mx-auto space-y-8 py-10">
              <div className="bg-white border-2 border-slate-900 p-20 text-center space-y-6 relative overflow-hidden">
                <CommandLineIcon className="w-12 h-12 text-slate-900 mx-auto" />
                <h2 className="text-4xl font-black uppercase italic tracking-tighter">Document Ingestion</h2>
                <div className="pt-6">
                  <label className="bg-slate-900 hover:bg-black text-white px-10 py-4 font-black cursor-pointer uppercase text-xs">
                    <input type="file" multiple className="hidden" onChange={onFileUpload} /> Select CAD Files
                  </label>
                </div>
              </div>
              {files.length > 0 && (
                <div className="bg-white border-2 border-slate-900 overflow-hidden shadow-xl">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase font-black">Queue: {files.length} Files</span>
                    <button onClick={runDiligence} className="bg-slate-900 text-white px-8 py-3 text-[10px] font-black uppercase">Run Axiom Audit</button>
                  </div>
                  <div className="p-8 grid grid-cols-6 gap-4">
                    {files.map((f, i) => (
                      <div key={i} className="aspect-square bg-slate-100 border border-slate-200 relative overflow-hidden group">
                        <img src={f.data} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={f.name} />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-[7px] text-white font-mono truncate uppercase tracking-tighter">{f.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
        )}

        {activeTab === 'map' && buildingMap && (
          <div className="space-y-8">
             <div className="bg-white border-2 border-slate-900 p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 shadow-xl">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-mono text-slate-900 font-black uppercase tracking-widest">System_Synced</span>
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Structural Spatial Inventory</h2>
                </div>
                <button onClick={() => setActiveTab('visualizer')} className="bg-slate-900 text-white px-10 py-4 font-black uppercase text-xs flex items-center gap-3">Launch Visualization Pipeline <ArrowRightIcon className="w-4 h-4" /></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {buildingMap.rooms.map(room => (
                  <div key={room.id} className="bg-white border-2 border-slate-900 overflow-hidden group hover:border-slate-900 transition-all">
                     <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                       <h3 className="text-xs font-black uppercase italic tracking-tight">{room.name}</h3>
                       <span className="text-[9px] font-mono bg-white/10 px-2 py-0.5 uppercase">LVL_{room.level}</span>
                     </div>
                     <div className="p-6 space-y-4">
                       <div className="flex justify-between font-mono text-[10px] border-b pb-2">
                         <span className="text-slate-400">DIM: {room.dimensions}</span>
                         <span className="text-slate-900 font-black">{room.sqFt} SQFT</span>
                       </div>
                       <div className="space-y-1">
                         {room.structuralFeatures.map((f, idx) => (
                           <div key={idx} className="flex justify-between text-[9px] p-2 bg-slate-50 border-l-2 border-slate-900">
                             <span className="font-black uppercase text-slate-700">{f.type}</span>
                             <span className="text-slate-400 italic font-mono uppercase text-[8px]">{f.location}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t-2 border-slate-900 p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Active Constitution</span>
          <span className="block text-[11px] font-black uppercase">{library.filter(i => i.isActive && i.category === 'A').length} Hard-Coded Axioms</span>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Render Architecture</span>
          <span className="block text-[11px] font-black uppercase text-slate-900">Stage-2 Validated Pipeline</span>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Reference Code</span>
          <span className="block text-[11px] font-black uppercase">CH-4317-N-PARK</span>
        </div>
        <div className="space-y-1 text-right">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Sheet Designation</span>
          <span className="block text-2xl font-black leading-none uppercase tracking-tighter">A-{activeTab === 'library' ? '000' : activeTab === 'blueprints' ? '001' : activeTab === 'map' ? '102' : '400'}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

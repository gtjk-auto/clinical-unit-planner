"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type Task = { id: number; task: string; cu: number; unit: string; type: string; division: string };
type Provider = { id: number; name: string; division: string; effort: number; earned: number };
type Tab = "overview" | "calculator" | "library" | "providers";

const BASE_TARGET = 460;
const seedTasks: Task[] = [
  { id: 1, task: "Inpatient consult service", cu: 5.5, unit: "day", type: "Inpatient service", division: "Cardiology" },
  { id: 2, task: "Outpatient clinic", cu: 3.5, unit: "session", type: "Outpatient", division: "Cardiology" },
  { id: 3, task: "Cardiac CT reads", cu: 0.35, unit: "read", type: "Ancillary", division: "Cardiology" },
  { id: 4, task: "Cath lab coverage", cu: 6.5, unit: "day", type: "Procedural", division: "Cardiology" },
  { id: 5, task: "Fellows clinic", cu: 2.75, unit: "session", type: "Outpatient", division: "Cardiology" },
  { id: 6, task: "MICU attending", cu: 7.5, unit: "day", type: "Inpatient service", division: "Pulmonary" },
  { id: 7, task: "Bronchoscopy", cu: 1.25, unit: "procedure", type: "Procedural", division: "Pulmonary" },
  { id: 8, task: "Pulmonary clinic", cu: 3.25, unit: "session", type: "Outpatient", division: "Pulmonary" },
  { id: 9, task: "PFT interpretation", cu: 0.3, unit: "read", type: "Ancillary", division: "Pulmonary" },
  { id: 10, task: "Allergy clinic", cu: 3, unit: "session", type: "Outpatient", division: "Clinical Immunology" },
  { id: 11, task: "Infusion supervision", cu: 2.25, unit: "session", type: "Procedural", division: "Clinical Immunology" },
  { id: 12, task: "Inpatient immunology consult", cu: 5, unit: "day", type: "Inpatient service", division: "Clinical Immunology" },
];
const seedProviders: Provider[] = [
  { id: 1, name: "Dr. Elena Vasquez", division: "Cardiology", effort: 80, earned: 292 },
  { id: 2, name: "Dr. Marcus Chen", division: "Cardiology", effort: 60, earned: 264 },
  { id: 3, name: "Dr. Priya Nair", division: "Cardiology", effort: 70, earned: 322 },
  { id: 4, name: "Dr. James Wilson", division: "Cardiology", effort: 50, earned: 241 },
  { id: 5, name: "Dr. Rachel Kim", division: "Cardiology", effort: 90, earned: 356 },
  { id: 6, name: "Dr. Omar Rahman", division: "Pulmonary", effort: 75, earned: 301 },
  { id: 7, name: "Dr. Sarah Brooks", division: "Pulmonary", effort: 60, earned: 282 },
  { id: 8, name: "Dr. David Lin", division: "Pulmonary", effort: 85, earned: 327 },
  { id: 9, name: "Dr. Amara Jones", division: "Clinical Immunology", effort: 65, earned: 246 },
  { id: 10, name: "Dr. Noah Patel", division: "Clinical Immunology", effort: 55, earned: 259 },
];

const targetFor = (effort: number) => Math.round(BASE_TARGET * effort / 100);
const initials = (name: string) => name.replace("Dr. ", "").split(" ").map(n => n[0]).join("");
const statusFor = (earned: number, target: number) => earned >= target ? "On target" : earned / target >= .9 ? "Near target" : "Behind";
const plural = (unit: string, count: number) => count === 1 ? unit : unit.endsWith("s") ? unit : `${unit}s`;

function csvRows(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/clinical/g, "clinical"));
  return lines.slice(1).map(line => {
    const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) ?? [];
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}
function parseTasks(text: string, startId: number): Task[] {
  return csvRows(text).map((row, index) => ({ id: startId + index, task: row.task, cu: Number(row.clinical_unit ?? row.clinicla_unit ?? row.cu), unit: row.unit, type: row.task_type ?? row.type, division: row.division ?? row.dision }))
    .filter(t => t.task && Number.isFinite(t.cu) && t.cu > 0 && t.unit && t.type && t.division);
}
function parseProviders(text: string, startId: number): Provider[] {
  return csvRows(text).map((row, index) => ({ id: startId + index, name: row.name, division: row.division ?? row.dision, effort: Number(row.clinical_effort ?? row.clinicla_effort ?? row.effort), earned: Number(row.current_cu ?? row.earned ?? 0) }))
    .filter(p => p.name && p.division && Number.isFinite(p.effort) && p.effort >= 0 && p.effort <= 100);
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [division, setDivision] = useState("Cardiology");
  const [taskLibrary, setTaskLibrary] = useState(seedTasks);
  const [providerRoster, setProviderRoster] = useState(seedProviders);
  const [selectedId, setSelectedId] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState<number | "">("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const taskFileRef = useRef<HTMLInputElement>(null);
  const providerFileRef = useRef<HTMLInputElement>(null);

  const divisions = [...new Set([...providerRoster.map(p => p.division), ...taskLibrary.map(t => t.division)])].sort();
  const divisionProviders = providerRoster.filter(p => p.division === division);
  const divisionTasks = taskLibrary.filter(t => t.division === division);
  const selected = providerRoster.find(p => p.id === selectedId && p.division === division) ?? divisionProviders[0];
  const target = selected ? targetFor(selected.effort) : 0;
  const gap = selected ? Math.max(0, target - selected.earned) : 0;
  const assignedTasks = divisionTasks.filter(task => quantities[task.id] !== undefined);
  const planned = assignedTasks.reduce((sum, task) => sum + (quantities[task.id] ?? 0) * task.cu, 0);
  const remaining = Math.max(0, gap - planned);

  const totals = useMemo(() => {
    const earned = divisionProviders.reduce((sum, p) => sum + p.earned, 0);
    const target = divisionProviders.reduce((sum, p) => sum + targetFor(p.effort), 0);
    return { earned, target, pct: target ? earned / target * 100 : 0, below: divisionProviders.filter(p => p.earned < targetFor(p.effort)).length };
  }, [providerRoster, division]);

  const flash = (message: string) => { setNotice(message); setTimeout(() => setNotice(""), 4000); };
  const switchDivision = (next: string) => {
    setDivision(next); setSelectedId(providerRoster.find(p => p.division === next)?.id ?? 0); setSelectedTaskId(""); setQuantities({});
  };
  const updateEarned = (earned: number) => selected && setProviderRoster(providerRoster.map(p => p.id === selected.id ? { ...p, earned: Math.max(0, earned) } : p));
  const addTask = () => {
    if (selectedTaskId === "") return;
    setQuantities({ ...quantities, [selectedTaskId]: quantities[selectedTaskId] ?? 1 }); setSelectedTaskId("");
  };
  const importTasks = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { const parsed = parseTasks(String(reader.result), taskLibrary.length + 1); parsed.length ? (setTaskLibrary([...taskLibrary, ...parsed]), flash(`${parsed.length} task${parsed.length === 1 ? "" : "s"} added`), setTab("library")) : flash("No valid task rows found. Check the five required columns."); };
    reader.readAsText(file); event.target.value = "";
  };
  const importProviders = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { const parsed = parseProviders(String(reader.result), providerRoster.length + 1); parsed.length ? (setProviderRoster([...providerRoster, ...parsed]), setDivision(parsed[0].division), setSelectedId(parsed[0].id), setQuantities({}), flash(`${parsed.length} provider${parsed.length === 1 ? "" : "s"} added`), setTab("providers")) : flash("No valid providers found. Check Name, Division, and Clinical effort."); };
    reader.readAsText(file); event.target.value = "";
  };

  const proposalTasks = [...divisionTasks].sort((a, b) => b.cu - a.cu).slice(0, 2);

  return <main>
    <header className="topbar"><div className="brandmark">cu</div><div><div className="eyebrow">Clinical operations</div><h1>Clinical Unit Planner</h1></div><div className="fiscal">Fiscal year <b>2026</b></div><button className="avatar" aria-label="Account menu">JL</button></header>
    <nav aria-label="Primary navigation">
      <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
      <button className={tab === "calculator" ? "active" : ""} onClick={() => setTab("calculator")}>Calculator</button>
      <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Task library <span>{taskLibrary.length}</span></button>
      <button className={tab === "providers" ? "active" : ""} onClick={() => setTab("providers")}>Providers <span>{providerRoster.length}</span></button>
    </nav>
    <input ref={taskFileRef} hidden type="file" accept=".csv,text/csv" onChange={importTasks}/><input ref={providerFileRef} hidden type="file" accept=".csv,text/csv" onChange={importProviders}/>
    {notice && <div className="toast">{notice}</div>}

    <section className="shell">
      <div className="pagehead">
        <div><div className="eyebrow">Division workspace</div><select aria-label="Clinical division" value={division} onChange={e => switchDivision(e.target.value)}>{divisions.map(d => <option key={d}>{d}</option>)}</select><p>{divisionProviders.length} providers · {divisionTasks.length} eligible clinical tasks</p></div>
        <div className="head-actions"><button className="outline" onClick={() => providerFileRef.current?.click()}><span>↑</span> Import providers</button><button className="outline" onClick={() => taskFileRef.current?.click()}><span>↑</span> Import tasks</button></div>
      </div>

      {tab === "overview" && <>
        <div className="stats"><article><span>Division attainment</span><strong>{totals.pct.toFixed(1)}%</strong><small className="good">{totals.earned.toFixed(0)} CU earned</small></article><article><span>Units remaining</span><strong>{Math.max(0, totals.target - totals.earned).toFixed(0)}</strong><small>of {totals.target} CU target</small></article><article><span>Below target</span><strong>{totals.below} <i>/ {divisionProviders.length}</i></strong><small className={totals.below ? "warn" : "good"}>{totals.below ? "Review individual plans" : "Everyone is on track"}</small></article><article><span>Target basis</span><strong>460 <i>CU</i></strong><small>at 100% clinical effort</small></article></div>
        <section className="panel"><div className="panelhead"><div><h2>Provider progress</h2><p>Targets automatically adjust to each provider’s clinical effort</p></div><div className="legend"><i className="dot red"/>Behind <i className="dot gold"/>Near <i className="dot green"/>On target</div></div><ProviderTable providers={divisionProviders} onPlan={p => { setSelectedId(p.id); setQuantities({}); setTab("calculator"); }}/></section>
      </>}

      {tab === "calculator" && <div className="calculator-grid">
        <section className="panel calc-main">
          <div className="calc-title"><div><div className="eyebrow">Clinical unit calculator</div><h2>Build a provider plan</h2><p>Choose the provider and explicitly assign only the activities they will complete.</p></div><button className="text-button" onClick={() => setQuantities({})}>Clear plan</button></div>
          <div className="selection-flow">
            <label><span>1</span><b>Division</b><select value={division} onChange={e => switchDivision(e.target.value)}>{divisions.map(d => <option key={d}>{d}</option>)}</select></label>
            <div className="flow-arrow">→</div>
            <label><span>2</span><b>Provider</b><select value={selected?.id ?? ""} onChange={e => { setSelectedId(Number(e.target.value)); setQuantities({}); }}><option value="" disabled>Select provider</option>{divisionProviders.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
          </div>
          {selected ? <>
            <div className="target-strip"><div className="selected-person"><i>{initials(selected.name)}</i><div><b>{selected.name}</b><small>{selected.effort}% clinical effort</small></div></div><label><span>Current CUs</span><input type="number" min="0" value={selected.earned} onChange={e => updateEarned(Number(e.target.value))}/></label><div><span>CU target</span><b>{target}</b></div><div className="gap-box"><span>Gap to close</span><b>{gap}</b></div></div>
            <div className="assign-block"><div><div className="eyebrow">3 · Assign activity</div><h3>What will {selected.name.replace("Dr. ", "Dr. ")} complete?</h3><p>Only {division} tasks are available. Nothing is added until you choose it.</p></div><div className="task-picker"><select aria-label="Task to assign" value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value ? Number(e.target.value) : "")}><option value="">Select a task…</option>{divisionTasks.filter(t => quantities[t.id] === undefined).map(t => <option value={t.id} key={t.id}>{t.task} · {t.cu} CU/{t.unit}</option>)}</select><button className="primary" disabled={selectedTaskId === ""} onClick={addTask}>Add task</button></div></div>
            <div className="assignment-list">
              {assignedTasks.length === 0 ? <div className="empty-plan"><div>＋</div><b>No activities assigned</b><p>Select a task above to begin testing a plan.</p></div> : assignedTasks.map(task => { const qty = quantities[task.id] ?? 0; return <div className="assignment" key={task.id}><div className={`task-icon ${task.type.toLowerCase().replace(/\s/g,"-")}`}>{task.type === "Inpatient service" ? "+" : task.type === "Outpatient" ? "⌂" : task.type === "Procedural" ? "◇" : "≋"}</div><div className="task-name"><b>{task.task}</b><small>{task.type} · {task.cu} CU per {task.unit}</small></div><div className="quantity-label">Number of {plural(task.unit, 2)}</div><div className="stepper"><button onClick={() => setQuantities({...quantities,[task.id]:Math.max(0,qty-1)})}>−</button><input aria-label={`${task.task} units`} type="number" min="0" value={qty} onChange={e => setQuantities({...quantities,[task.id]:Math.max(0,Number(e.target.value))})}/><button onClick={() => setQuantities({...quantities,[task.id]:qty+1})}>+</button></div><div className="task-total"><b>{(qty*task.cu).toFixed(1)}</b><small>CU</small></div><button className="remove" aria-label={`Remove ${task.task}`} onClick={() => { const next={...quantities}; delete next[task.id]; setQuantities(next); }}>×</button></div> })}
            </div>
          </> : <div className="empty-plan"><b>No providers in this division</b><p>Import the provider roster to begin.</p></div>}
        </section>
        <aside className="calc-aside">
          {selected && <section className="result-card"><div className="eyebrow">Plan impact</div><div className="ring" style={{"--pct":`${target ? Math.min(100,(selected.earned+planned)/target*100) : 0}%`} as React.CSSProperties}><div><strong>{target ? Math.round((selected.earned+planned)/target*100) : 0}%</strong><span>of target</span></div></div><div className="result-row"><span>Assigned activities</span><b>+{planned.toFixed(1)} CU</b></div><div className="result-row"><span>Projected total</span><b>{(selected.earned+planned).toFixed(1)} CU</b></div><div className="result-row total"><span>{remaining ? "Still needed" : "Target reached"}</span><b>{remaining ? `${remaining.toFixed(1)} CU` : "✓"}</b></div><button className="primary" disabled={!assignedTasks.length} onClick={() => flash("Calculator plan saved for review")}>Save plan</button></section>}
          {selected && remaining > 0 && <section className="proposals"><div className="proposal-head"><div className="bulb">✦</div><div><div className="eyebrow">Proposed methods</div><h3>Ways to close {remaining.toFixed(1)} CU</h3></div></div><p>These are options—not assignments. Select one to add it to the calculator.</p>{proposalTasks.length ? proposalTasks.map(task => { const count = Math.ceil(remaining / task.cu); return <button className="proposal" key={task.id} onClick={() => setQuantities({...quantities,[task.id]:(quantities[task.id] ?? 0)+count})}><span><b>{count} {plural(task.unit,count)}</b><small>{task.task}</small></span><strong>+{(count*task.cu).toFixed(1)} CU</strong><i>Use plan →</i></button> }) : <small>Import a task library for {division} to generate options.</small>}</section>}
        </aside>
      </div>}

      {tab === "library" && <section className="panel library"><div className="panelhead"><div><h2>Clinical task library</h2><p>Tasks available to the {division} calculator</p></div><div className="library-actions"><input placeholder="Search tasks" value={search} onChange={e => setSearch(e.target.value)}/><button className="primary" onClick={() => taskFileRef.current?.click()}>Import task CSV</button></div></div><div className="schema-note"><b>Required CSV columns</b><span>Task</span><span>Clinical unit</span><span>Unit</span><span>Task type</span><span>Division</span></div><div className="task-table"><div className="task-row labels"><span>Task</span><span>CU value</span><span>Unit</span><span>Task type</span><span>Division</span></div>{divisionTasks.filter(t => t.task.toLowerCase().includes(search.toLowerCase())).map(t => <div className="task-row" key={t.id}><span><b>{t.task}</b></span><span className="cu-pill">{t.cu}</span><span>{t.unit}</span><span>{t.type}</span><span>{t.division}</span></div>)}</div></section>}

      {tab === "providers" && <section className="panel roster"><div className="panelhead"><div><h2>Provider roster</h2><p>Doctors available to the {division} calculator</p></div><button className="primary" onClick={() => providerFileRef.current?.click()}>Import provider CSV</button></div><div className="schema-note"><b>Required CSV columns</b><span>Name</span><span>Division</span><span>Clinical effort</span><em>Optional: Current CU</em></div><ProviderTable providers={divisionProviders} onPlan={p => { setSelectedId(p.id); setQuantities({}); setTab("calculator"); }}/></section>}
    </section>
    <footer><span>Clinical Unit Planner</span><span>Targets are planning estimates and should be reviewed against approved divisional policy.</span></footer>
  </main>;
}

function ProviderTable({ providers, onPlan }: { providers: Provider[]; onPlan: (provider: Provider) => void }) {
  return <div className="table provider-table"><div className="tr labels"><span>Provider</span><span>Effort</span><span>CU progress</span><span>Status</span><span></span></div>{providers.map(p => { const target=targetFor(p.effort), pct=target ? Math.round(p.earned/target*100) : 100, status=statusFor(p.earned,target); return <div className="tr" key={p.id}><span className="person"><i>{initials(p.name)}</i><b>{p.name}<small>{p.division}</small></b></span><span className="effort">{p.effort}%</span><span className="progress"><b>{p.earned} <small>/ {target} CU</small></b><em><u className={status === "On target" ? "greenbar" : status === "Near target" ? "goldbar" : "redbar"} style={{width:`${Math.min(pct,100)}%`}}/></em><small>{pct}% complete · {Math.max(0,target-p.earned)} remaining</small></span><span><mark className={status === "On target" ? "on" : status === "Near target" ? "near" : "behind"}>{status}</mark></span><button className="arrow" onClick={() => onPlan(p)} aria-label={`Open calculator for ${p.name}`}>→</button></div>})}{!providers.length && <div className="empty-plan"><b>No providers in this division</b><p>Import a provider CSV to add the roster.</p></div>}</div>;
}

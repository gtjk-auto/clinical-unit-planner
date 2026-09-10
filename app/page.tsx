"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

type Task = { id: number; task: string; cu: number; unit: string; type: string; division: string };
type Provider = { id: number; name: string; division: string; effort: number; earned: number; trend: number };

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

const providers: Provider[] = [
  { id: 1, name: "Dr. Elena Vasquez", division: "Cardiology", effort: 80, earned: 292, trend: 8 },
  { id: 2, name: "Dr. Marcus Chen", division: "Cardiology", effort: 60, earned: 264, trend: 4 },
  { id: 3, name: "Dr. Priya Nair", division: "Cardiology", effort: 70, earned: 322, trend: 1 },
  { id: 4, name: "Dr. James Wilson", division: "Cardiology", effort: 50, earned: 241, trend: 6 },
  { id: 5, name: "Dr. Rachel Kim", division: "Cardiology", effort: 90, earned: 356, trend: -3 },
  { id: 6, name: "Dr. Omar Rahman", division: "Pulmonary", effort: 75, earned: 301, trend: 7 },
  { id: 7, name: "Dr. Sarah Brooks", division: "Pulmonary", effort: 60, earned: 282, trend: 2 },
  { id: 8, name: "Dr. David Lin", division: "Pulmonary", effort: 85, earned: 327, trend: -1 },
  { id: 9, name: "Dr. Amara Jones", division: "Clinical Immunology", effort: 65, earned: 246, trend: 5 },
  { id: 10, name: "Dr. Noah Patel", division: "Clinical Immunology", effort: 55, earned: 259, trend: 3 },
];

const initials = (name: string) => name.replace("Dr. ", "").split(" ").map(n => n[0]).join("");
const targetFor = (effort: number) => Math.round(BASE_TARGET * effort / 100);
const statusFor = (earned: number, target: number) => earned >= target ? "On target" : earned / target >= .9 ? "Near target" : "Behind";

function parseCsv(text: string, startId: number): Task[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line, index) => {
    const values = line.match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) ?? [];
    const row = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
    return { id: startId + index, task: row.task, cu: Number(row.clinical_unit ?? row.cu), unit: row.unit, type: row.task_type ?? row.type, division: row.division };
  }).filter(t => t.task && Number.isFinite(t.cu) && t.unit && t.type && t.division);
}

export default function Home() {
  const [tab, setTab] = useState<"overview" | "planner" | "library">("overview");
  const [division, setDivision] = useState("Cardiology");
  const [taskLibrary, setTaskLibrary] = useState(seedTasks);
  const [selectedId, setSelectedId] = useState(1);
  const [quantities, setQuantities] = useState<Record<number, number>>({ 1: 4, 2: 3 });
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const divisions = [...new Set([...providers.map(p => p.division), ...taskLibrary.map(t => t.division)])];
  const divisionProviders = providers.filter(p => p.division === division);
  const divisionTasks = taskLibrary.filter(t => t.division === division);
  const selected = providers.find(p => p.id === selectedId && p.division === division) ?? divisionProviders[0];
  const target = selected ? targetFor(selected.effort) : 0;
  const originalGap = selected ? Math.max(0, target - selected.earned) : 0;
  const planned = divisionTasks.reduce((sum, task) => sum + (quantities[task.id] ?? 0) * task.cu, 0);
  const remaining = Math.max(0, originalGap - planned);

  const totals = useMemo(() => {
    const earned = divisionProviders.reduce((s, p) => s + p.earned, 0);
    const target = divisionProviders.reduce((s, p) => s + targetFor(p.effort), 0);
    const below = divisionProviders.filter(p => p.earned < targetFor(p.effort)).length;
    return { earned, target, pct: target ? earned / target * 100 : 0, below };
  }, [division]);

  const importData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result), taskLibrary.length + 1);
      if (parsed.length) { setTaskLibrary([...taskLibrary, ...parsed]); setNotice(`${parsed.length} task${parsed.length === 1 ? "" : "s"} added to the library`); setTab("library"); }
      else setNotice("No valid rows found. Check the five required columns.");
      setTimeout(() => setNotice(""), 4000);
    };
    reader.readAsText(file); event.target.value = "";
  };

  const switchDivision = (next: string) => {
    setDivision(next); const first = providers.find(p => p.division === next); if (first) setSelectedId(first.id); setQuantities({});
  };

  return <main>
    <header className="topbar">
      <div className="brandmark">cu</div>
      <div><div className="eyebrow">Clinical operations</div><h1>Clinical Unit Planner</h1></div>
      <div className="fiscal">Fiscal year <b>2026</b></div>
      <button className="avatar" aria-label="Account menu">JL</button>
    </header>
    <nav aria-label="Primary navigation">
      <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
      <button className={tab === "planner" ? "active" : ""} onClick={() => setTab("planner")}>What-if planner</button>
      <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}>Task library <span>{taskLibrary.length}</span></button>
    </nav>
    <input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={importData} />
    {notice && <div className="toast">{notice}</div>}

    <section className="shell">
      <div className="pagehead">
        <div><div className="eyebrow">Division workspace</div><select aria-label="Clinical division" value={division} onChange={e => switchDivision(e.target.value)}>{divisions.map(d => <option key={d}>{d}</option>)}</select><p>{divisionProviders.length} providers · {divisionTasks.length} active clinical tasks</p></div>
        <button className="outline" onClick={() => fileRef.current?.click()}><span>↑</span> Import task library</button>
      </div>

      {tab === "overview" && <>
        <div className="stats">
          <article><span>Division attainment</span><strong>{totals.pct.toFixed(1)}%</strong><small className="good">{totals.earned.toFixed(0)} CU earned</small></article>
          <article><span>Units remaining</span><strong>{Math.max(0, totals.target - totals.earned).toFixed(0)}</strong><small>of {totals.target} CU target</small></article>
          <article><span>Below target</span><strong>{totals.below} <i>/ {divisionProviders.length}</i></strong><small className={totals.below ? "warn" : "good"}>{totals.below ? "Review individual plans" : "Everyone is on track"}</small></article>
          <article><span>Target basis</span><strong>460 <i>CU</i></strong><small>at 100% clinical effort</small></article>
        </div>
        <section className="panel">
          <div className="panelhead"><div><h2>Provider progress</h2><p>Targets automatically adjust to each provider’s clinical effort</p></div><div className="legend"><i className="dot red" />Behind <i className="dot gold" />Near <i className="dot green" />On target</div></div>
          <div className="table provider-table">
            <div className="tr labels"><span>Provider</span><span>Effort</span><span>CU progress</span><span>Status</span><span></span></div>
            {divisionProviders.map(p => { const target = targetFor(p.effort), pct = Math.round(p.earned / target * 100), status = statusFor(p.earned, target); return <div className="tr" key={p.id}>
              <span className="person"><i>{initials(p.name)}</i><b>{p.name}<small>{p.division}</small></b></span>
              <span className="effort">{p.effort}%</span>
              <span className="progress"><b>{p.earned} <small>/ {target} CU</small></b><em><u className={status === "On target" ? "greenbar" : status === "Near target" ? "goldbar" : "redbar"} style={{width:`${Math.min(pct,100)}%`}} /></em><small>{pct}% complete · {Math.max(0,target-p.earned)} remaining</small></span>
              <span><mark className={status === "On target" ? "on" : status === "Near target" ? "near" : "behind"}>{status}</mark></span>
              <button className="arrow" onClick={() => {setSelectedId(p.id);setQuantities({});setTab("planner")}} aria-label={`Build a plan for ${p.name}`}>→</button>
            </div>})}
          </div>
        </section>
      </>}

      {tab === "planner" && selected && <div className="planner-grid">
        <section className="panel plan-main">
          <div className="panelhead"><div><div className="eyebrow">Scenario builder</div><h2>Close the gap</h2><p>Adjust activity volumes to model an achievable path to target.</p></div></div>
          <div className="provider-select"><label>Provider<select value={selected.id} onChange={e => {setSelectedId(Number(e.target.value));setQuantities({})}}>{divisionProviders.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><div className="effort-chip"><span>Clinical effort</span><b>{selected.effort}%</b></div></div>
          <div className="gap-banner"><div><span>Current</span><b>{selected.earned} CU</b></div><i>→</i><div><span>Target</span><b>{target} CU</b></div><div className="gap"><span>Gap to close</span><b>{originalGap} CU</b></div></div>
          <div className="activity-head"><div><h3>Build activity mix</h3><p>Choose any combination of {division} activities.</p></div><button onClick={() => setQuantities({})}>Reset</button></div>
          <div className="activities">
            {divisionTasks.map(task => { const qty = quantities[task.id] ?? 0; return <div className="activity" key={task.id}>
              <div className={`task-icon ${task.type.toLowerCase().replace(/\s/g,"-")}`}>{task.type === "Inpatient service" ? "+" : task.type === "Outpatient" ? "⌂" : task.type === "Procedural" ? "◇" : "≋"}</div>
              <div className="task-name"><b>{task.task}</b><small>{task.type} · {task.cu} CU per {task.unit}</small></div>
              <div className="stepper"><button onClick={() => setQuantities({...quantities,[task.id]:Math.max(0,qty-1)})}>−</button><input aria-label={`${task.task} quantity`} type="number" min="0" value={qty} onChange={e => setQuantities({...quantities,[task.id]:Math.max(0,Number(e.target.value))})}/><button onClick={() => setQuantities({...quantities,[task.id]:qty+1})}>+</button></div>
              <div className="task-total"><b>{(qty*task.cu).toFixed(1)}</b><small>CU</small></div>
            </div>})}
          </div>
        </section>
        <aside className="plan-aside">
          <section className={`result-card ${remaining === 0 && originalGap > 0 ? "complete" : ""}`}>
            <div className="eyebrow">Scenario impact</div><div className="ring" style={{"--pct":`${Math.min(100, (selected.earned + planned) / target * 100)}%`} as React.CSSProperties}><div><strong>{Math.round((selected.earned+planned)/target*100)}%</strong><span>of target</span></div></div>
            <div className="result-row"><span>Planned activity</span><b>+{planned.toFixed(1)} CU</b></div><div className="result-row"><span>Projected total</span><b>{(selected.earned+planned).toFixed(1)} CU</b></div><div className="result-row total"><span>{remaining ? "Still needed" : "Above target"}</span><b>{remaining ? remaining.toFixed(1) : Math.max(0,planned-originalGap).toFixed(1)} CU</b></div>
            <button className="primary" disabled={planned === 0} onClick={() => {setNotice("Scenario saved for review");setTimeout(()=>setNotice(""),3000)}}>{remaining ? "Save scenario" : "Save completed plan"}</button>
          </section>
          {originalGap > 0 && <section className="suggestion"><div className="bulb">✦</div><div><div className="eyebrow">Suggested path</div><h3>A simple way to close {remaining ? `${remaining.toFixed(1)} CU` : "the gap"}</h3>{remaining ? <p>{(() => { const best = [...divisionTasks].sort((a,b)=>b.cu-a.cu)[0]; return best ? `Add ${Math.ceil(remaining/best.cu)} ${best.task.toLowerCase()} ${best.unit}s to reach the target.` : "Import tasks for this division to generate a suggestion." })()}</p> : <p>This scenario meets the provider’s adjusted clinical unit target.</p>}</div></section>}
        </aside>
      </div>}

      {tab === "library" && <section className="panel library">
        <div className="panelhead"><div><h2>Clinical task library</h2><p>CU values available to the {division} calculator</p></div><div className="library-actions"><input placeholder="Search tasks" value={search} onChange={e=>setSearch(e.target.value)} /><button className="primary" onClick={()=>fileRef.current?.click()}>Import CSV</button></div></div>
        <div className="schema-note"><b>CSV format</b><span>Task</span><span>Clinical unit</span><span>Unit</span><span>Task type</span><span>Division</span></div>
        <div className="task-table">
          <div className="task-row labels"><span>Task</span><span>CU value</span><span>Unit</span><span>Task type</span><span>Division</span></div>
          {taskLibrary.filter(t => t.division === division && t.task.toLowerCase().includes(search.toLowerCase())).map(t => <div className="task-row" key={t.id}><span><b>{t.task}</b></span><span className="cu-pill">{t.cu}</span><span>{t.unit}</span><span>{t.type}</span><span>{t.division}</span></div>)}
        </div>
      </section>}
    </section>
    <footer><span>Clinical Unit Planner</span><span>Targets are planning estimates and should be reviewed against approved divisional policy.</span></footer>
  </main>;
}

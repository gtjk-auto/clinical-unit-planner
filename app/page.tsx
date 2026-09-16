"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Task = { id: number; task: string; cu: number; days: number; serviceWeekDays?: number; unit: string; type: string; division: string };
type Provider = { id: number; name: string; division: string; effort: number; earned: number };
type Tab = "overview" | "calculator" | "approved" | "library" | "providers";
type PlanLine = { task: string; unit: string; type?: string; quantity: number; libraryCu: number; appliedCu: number; totalCu: number; libraryDays?: number; appliedDays?: number; totalDays?: number; libraryServiceWeekDays?: number; appliedServiceWeekDays?: number; serviceWeekDaysOverridden?: boolean; cuOverridden?: boolean; daysOverridden?: boolean; overridden: boolean };
type SavedPlan = { id: number; providerName: string; division: string; clinicalEffort: number; adjustedFte: number; targetCu: number; plannedCu: number; vacationWeeks?: number; hasOverrides: boolean; lines: PlanLine[]; status: string; createdAt: string };

const BASE_TARGET = 460;
const seedTasks: Task[] = [
  { id: 1, task: "Inpatient consult service", cu: 5.5, days: 1, serviceWeekDays: 5, unit: "day", type: "Inpatient service", division: "Cardiology" },
  { id: 2, task: "Outpatient clinic", cu: 3.5, days: .5, unit: "session", type: "Outpatient", division: "Cardiology" },
  { id: 3, task: "Cardiac CT reads", cu: 0.35, days: .5, unit: "read block", type: "Ancillary", division: "Cardiology" },
  { id: 4, task: "Cath lab coverage", cu: 6.5, days: .5, unit: "half-day block", type: "Procedural", division: "Cardiology" },
  { id: 5, task: "Fellows clinic", cu: 2.75, days: .5, unit: "session", type: "Outpatient", division: "Cardiology" },
  { id: 6, task: "MICU attending", cu: 7.5, days: 1, serviceWeekDays: 5, unit: "day", type: "Inpatient service", division: "Pulmonary" },
  { id: 7, task: "Bronchoscopy", cu: 1.25, days: .5, unit: "half-day block", type: "Procedural", division: "Pulmonary" },
  { id: 8, task: "Pulmonary clinic", cu: 3.25, days: .5, unit: "session", type: "Outpatient", division: "Pulmonary" },
  { id: 9, task: "PFT interpretation", cu: 0.3, days: .5, unit: "read block", type: "Ancillary", division: "Pulmonary" },
  { id: 10, task: "Allergy clinic", cu: 3, days: .5, unit: "session", type: "Outpatient", division: "Clinical Immunology" },
  { id: 11, task: "Infusion supervision", cu: 2.25, days: .5, unit: "half-day block", type: "Procedural", division: "Clinical Immunology" },
  { id: 12, task: "Inpatient immunology consult", cu: 5, days: 1, serviceWeekDays: 5, unit: "day", type: "Inpatient service", division: "Clinical Immunology" },
];
const seedProviders: Provider[] = [
  { id: 1, name: "Dr. Elena Vasquez", division: "Cardiology", effort: 80, earned: 0 },
  { id: 2, name: "Dr. Marcus Chen", division: "Cardiology", effort: 60, earned: 0 },
  { id: 3, name: "Dr. Priya Nair", division: "Cardiology", effort: 70, earned: 0 },
  { id: 4, name: "Dr. James Wilson", division: "Cardiology", effort: 50, earned: 0 },
  { id: 5, name: "Dr. Rachel Kim", division: "Cardiology", effort: 90, earned: 0 },
  { id: 6, name: "Dr. Omar Rahman", division: "Pulmonary", effort: 75, earned: 0 },
  { id: 7, name: "Dr. Sarah Brooks", division: "Pulmonary", effort: 60, earned: 0 },
  { id: 8, name: "Dr. David Lin", division: "Pulmonary", effort: 85, earned: 0 },
  { id: 9, name: "Dr. Amara Jones", division: "Clinical Immunology", effort: 65, earned: 0 },
  { id: 10, name: "Dr. Noah Patel", division: "Clinical Immunology", effort: 55, earned: 0 },
];

const targetFor = (effort: number, adjustedFte = 1) => Math.round(BASE_TARGET * effort / 100 * adjustedFte);
const initials = (name: string) => name.replace("Dr. ", "").split(" ").map(n => n[0]).join("");
const statusFor = (earned: number, target: number) => earned >= target ? "On target" : earned / target >= .9 ? "Near target" : "Behind";
const plural = (unit: string, count: number) => count === 1 ? unit : unit.endsWith("s") ? unit : `${unit}s`;
const isInpatient = (task: Pick<Task, "type">) => task.type.toLowerCase().includes("inpatient");
const isProcedural = (task: Pick<Task, "type">) => task.type.toLowerCase().includes("procedur");
const isOutpatientOrPrecepting = (task: Pick<Task, "task" | "type">) => `${task.task} ${task.type}`.toLowerCase().match(/outpatient|precept/) !== null;
const hasLockedDays = (task: Pick<Task, "task" | "type">) => isProcedural(task) || isOutpatientOrPrecepting(task);
const taskDays = (task: Task, overrides: Record<number,number>) => isProcedural(task) ? .5 : hasLockedDays(task) ? task.days : overrides[task.id] ?? task.days;
const countUnit = (task: Task) => isProcedural(task) ? "half-day blocks" : plural(task.unit, 2);

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
  return csvRows(text).map((row, index) => {
    const type=row.task_type ?? row.type, inpatient=String(type).toLowerCase().includes("inpatient");
    const serviceWeekDays = Number(row.service_days_per_week ?? row.days_per_service_week ?? row.days_in_service_week ?? 5);
    const procedural=String(type).toLowerCase().includes("procedur");
    return { id: startId + index, task: row.task, cu: Number(row.clinical_unit ?? row.clinicla_unit ?? row.cu), days: inpatient ? 1 : procedural ? .5 : Number(row.days_per_task ?? row.day_value ?? row.days ?? .5), serviceWeekDays: inpatient ? serviceWeekDays : undefined, unit: inpatient ? "day" : procedural ? "half-day block" : row.unit, type, division: row.division ?? row.dision };
  }).filter(t => t.task && Number.isFinite(t.cu) && t.cu > 0 && Number.isFinite(t.days) && t.days > 0 && (!isInpatient(t) || Number.isFinite(t.serviceWeekDays) && (t.serviceWeekDays ?? 0) > 0) && t.unit && t.type && t.division);
}
function parseProviders(text: string, startId: number): Provider[] {
  return csvRows(text).map((row, index) => ({ id: startId + index, name: row.name, division: row.division ?? row.dision, effort: Number(row.clinical_effort ?? row.clinicla_effort ?? row.effort), earned: 0 }))
    .filter(p => p.name && p.division && Number.isFinite(p.effort) && p.effort >= 0 && p.effort <= 100);
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [division, setDivision] = useState("Cardiology");
  const [taskLibrary, setTaskLibrary] = useState(seedTasks);
  const [providerRoster, setProviderRoster] = useState(seedProviders);
  const [selectedId, setSelectedId] = useState(1);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [cuOverrides, setCuOverrides] = useState<Record<number, number>>({});
  const [dayOverrides, setDayOverrides] = useState<Record<number, number>>({});
  const [serviceWeekOverrides, setServiceWeekOverrides] = useState<Record<number, number>>({});
  const [adjustedFteEnabled, setAdjustedFteEnabled] = useState(false);
  const [adjustedFte, setAdjustedFte] = useState(1);
  const [suggestionEnabled, setSuggestionEnabled] = useState<Record<number, boolean>>({});
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const taskFileRef = useRef<HTMLInputElement>(null);
  const providerFileRef = useRef<HTMLInputElement>(null);

  const divisions = [...new Set([...providerRoster.map(p => p.division), ...taskLibrary.map(t => t.division)])].sort();
  const divisionProviders = providerRoster.filter(p => p.division === division);
  const divisionTasks = taskLibrary.filter(t => t.division === division);
  const selected = providerRoster.find(p => p.id === selectedId && p.division === division) ?? divisionProviders[0];
  const appliedAdjustedFte = adjustedFteEnabled ? adjustedFte : 1;
  const target = selected ? targetFor(selected.effort, appliedAdjustedFte) : 0;
  const gap = target;
  const assignedTasks = divisionTasks.filter(task => (quantities[task.id] ?? 0) > 0);
  const planned = assignedTasks.reduce((sum, task) => sum + (quantities[task.id] ?? 0) * (cuOverrides[task.id] ?? task.cu), 0);
  const remaining = Math.max(0, gap - planned);
  const excess = Math.max(0, planned - target);
  const inpatientDays = assignedTasks.filter(isInpatient).reduce((sum,task) => sum + (quantities[task.id] ?? 0), 0);
  const inpatientWeeks = assignedTasks.filter(isInpatient).reduce((sum,task) => sum + (quantities[task.id] ?? 0) / (serviceWeekOverrides[task.id] ?? task.serviceWeekDays ?? 5), 0);
  const outpatientDays = assignedTasks.filter(task => isOutpatientOrPrecepting(task)).reduce((sum,task) => sum + (quantities[task.id] ?? 0) * taskDays(task,dayOverrides), 0);
  const proceduralDays = assignedTasks.filter(task => isProcedural(task) && !isOutpatientOrPrecepting(task)).reduce((sum,task) => sum + (quantities[task.id] ?? 0) * .5, 0);
  const ancillaryDays = assignedTasks.filter(task => !isInpatient(task) && !isOutpatientOrPrecepting(task) && !isProcedural(task)).reduce((sum,task) => sum + (quantities[task.id] ?? 0) * taskDays(task,dayOverrides), 0);
  const plannedDays = inpatientDays + outpatientDays + proceduralDays + ancillaryDays;
  const capacityDays = selected ? 260 * selected.effort / 100 * appliedAdjustedFte : 0;
  const capacityRemainingDays = capacityDays - plannedDays;
  const capacityPct = capacityDays ? plannedDays / capacityDays * 100 : 0;
  const activeWeeks = 52 * appliedAdjustedFte;
  const schedulableWeeks = Math.max(0, activeWeeks - inpatientWeeks);

  useEffect(() => {
    fetch("/api/plans").then(response => response.ok ? response.json() : Promise.reject()).then(data => {
      const plans: SavedPlan[] = data.plans ?? []; setSavedPlans(plans);
      const provider = seedProviders[0]; const plan = plans.find(item => item.providerName === provider.name && item.division === provider.division);
      if (plan) {
        const nextQty: Record<number, number> = {}, nextOverrides: Record<number, number> = {}, nextDayOverrides: Record<number,number> = {}, nextServiceOverrides: Record<number,number> = {}, nextEnabled: Record<number,boolean> = {};
        plan.lines.forEach(line => { const task = seedTasks.find(item => item.task === line.task && item.division === plan.division); if (task) { nextQty[task.id] = line.quantity; nextEnabled[task.id]=true; if (line.cuOverridden ?? line.overridden) nextOverrides[task.id] = line.appliedCu; if (line.daysOverridden) nextDayOverrides[task.id]=line.appliedDays ?? task.days; if (line.serviceWeekDaysOverridden) nextServiceOverrides[task.id]=line.appliedServiceWeekDays ?? task.serviceWeekDays ?? 5; } });
        setQuantities(nextQty); setCuOverrides(nextOverrides); setDayOverrides(nextDayOverrides); setServiceWeekOverrides(nextServiceOverrides); setSuggestionEnabled(nextEnabled); setAdjustedFte(plan.adjustedFte ?? 1); setAdjustedFteEnabled((plan.adjustedFte ?? 1) !== 1); setCurrentPlanId(plan.id);
      }
    }).catch(() => undefined);
  }, []);

  const totals = useMemo(() => {
    const earned = divisionProviders.reduce((sum, p) => sum + p.earned, 0);
    const target = divisionProviders.reduce((sum, p) => sum + targetFor(p.effort), 0);
    return { earned, target, pct: target ? earned / target * 100 : 0, below: divisionProviders.filter(p => p.earned < targetFor(p.effort)).length };
  }, [providerRoster, division]);

  const flash = (message: string) => { setNotice(message); setTimeout(() => setNotice(""), 4000); };
  const switchDivision = (next: string) => {
    const provider = providerRoster.find(p => p.division === next); setDivision(next); setSelectedId(provider?.id ?? 0); setQuantities({}); setCuOverrides({}); setDayOverrides({}); setServiceWeekOverrides({}); setSuggestionEnabled({}); setAdjustedFte(1); setAdjustedFteEnabled(false); setCurrentPlanId(null);
    if (provider) loadSavedPlan(provider, next);
  };
  const loadSavedPlan = (provider: Provider, providerDivision = provider.division, plans = savedPlans) => {
    const plan = plans.find(item => item.providerName === provider.name && item.division === providerDivision);
    const nextQty: Record<number, number> = {}, nextOverrides: Record<number, number> = {}, nextDayOverrides: Record<number,number> = {}, nextServiceOverrides: Record<number,number> = {}, nextEnabled: Record<number,boolean> = {};
    if (plan) plan.lines.forEach(line => { const task = taskLibrary.find(item => item.task === line.task && item.division === providerDivision); if (task) { nextQty[task.id] = line.quantity; nextEnabled[task.id]=true; if (line.cuOverridden ?? line.overridden) nextOverrides[task.id] = line.appliedCu; if (line.daysOverridden) nextDayOverrides[task.id]=line.appliedDays ?? task.days; if (line.serviceWeekDaysOverridden) nextServiceOverrides[task.id]=line.appliedServiceWeekDays ?? task.serviceWeekDays ?? 5; } });
    setQuantities(nextQty); setCuOverrides(nextOverrides); setDayOverrides(nextDayOverrides); setServiceWeekOverrides(nextServiceOverrides); setSuggestionEnabled(nextEnabled); setAdjustedFte(plan?.adjustedFte ?? 1); setAdjustedFteEnabled((plan?.adjustedFte ?? 1) !== 1); setCurrentPlanId(plan?.id ?? null);
  };
  const selectProvider = (provider: Provider) => { setSelectedId(provider.id); loadSavedPlan(provider); };
  const savePlan = async () => {
    if (!selected || planned < target || saving) return;
    const lines: PlanLine[] = assignedTasks.map(task => {
      const appliedCu = cuOverrides[task.id] ?? task.cu, appliedDays = taskDays(task,dayOverrides), appliedServiceWeekDays = serviceWeekOverrides[task.id] ?? task.serviceWeekDays; const quantity = quantities[task.id] ?? 0;
      const cuOverridden=appliedCu !== task.cu, daysOverridden=!isInpatient(task) && !hasLockedDays(task) && appliedDays !== task.days, serviceWeekDaysOverridden=isInpatient(task) && appliedServiceWeekDays !== task.serviceWeekDays;
      return { task: task.task, unit: task.unit, type: task.type, quantity, libraryCu: task.cu, appliedCu, totalCu: quantity * appliedCu, libraryDays: task.days, appliedDays, totalDays: isInpatient(task) ? quantity : quantity * appliedDays, libraryServiceWeekDays: task.serviceWeekDays, appliedServiceWeekDays, serviceWeekDaysOverridden, cuOverridden, daysOverridden, overridden: cuOverridden || daysOverridden || serviceWeekDaysOverridden };
    });
    setSaving(true);
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: currentPlanId, providerName: selected.name, division, clinicalEffort: selected.effort, adjustedFte: appliedAdjustedFte, targetCu: target, plannedCu: planned, hasOverrides: lines.some(line => line.overridden), lines }) });
      if (!response.ok) throw new Error();
      const data = await response.json(); setSavedPlans(currentPlanId ? savedPlans.map(plan => plan.id === currentPlanId ? data.plan : plan) : [data.plan, ...savedPlans]); setCurrentPlanId(data.plan.id); setTab("approved"); flash(`Plan ${currentPlanId ? "updated" : "approved"} for ${selected.name}`);
    } catch { flash("The plan could not be saved. Please try again."); } finally { setSaving(false); }
  };
  const importTasks = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { const parsed = parseTasks(String(reader.result), taskLibrary.length + 1); parsed.length ? (setTaskLibrary([...taskLibrary, ...parsed]), flash(`${parsed.length} task${parsed.length === 1 ? "" : "s"} added`), setTab("library")) : flash("No valid task rows found. Check the five required columns."); };
    reader.readAsText(file); event.target.value = "";
  };
  const importProviders = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = () => { const parsed = parseProviders(String(reader.result), providerRoster.length + 1); parsed.length ? (setProviderRoster([...providerRoster, ...parsed]), setDivision(parsed[0].division), setSelectedId(parsed[0].id), setQuantities({}), setCuOverrides({}), setDayOverrides({}), setServiceWeekOverrides({}), setAdjustedFte(1), setAdjustedFteEnabled(false), flash(`${parsed.length} provider${parsed.length === 1 ? "" : "s"} added`), setTab("providers")) : flash("No valid providers found. Check Name, Division, and Clinical effort."); };
    reader.readAsText(file); event.target.value = "";
  };

  const proposalTasks = divisionTasks.filter(task => suggestionEnabled[task.id] ?? false).sort((a, b) => (cuOverrides[b.id] ?? b.cu) - (cuOverrides[a.id] ?? a.cu));
  const displayTasks = [...divisionTasks].sort((a,b) => Number(suggestionEnabled[b.id] ?? false) - Number(suggestionEnabled[a.id] ?? false));
  const savedPlanBeingEdited = savedPlans.find(plan => plan.id === currentPlanId);
  const editPlan = (plan: SavedPlan) => {
    let nextProviders = providerRoster; let provider = providerRoster.find(item => item.name === plan.providerName && item.division === plan.division);
    if (!provider) { provider = { id: Math.max(0,...providerRoster.map(item => item.id)) + 1, name: plan.providerName, division: plan.division, effort: plan.clinicalEffort, earned: 0 }; nextProviders = [...providerRoster, provider]; setProviderRoster(nextProviders); }
    let nextTasks = [...taskLibrary];
    plan.lines.forEach(line => { if (!nextTasks.some(task => task.task === line.task && task.division === plan.division)) { const inpatient=(line.type ?? "").toLowerCase().includes("inpatient"); nextTasks.push({ id: Math.max(0,...nextTasks.map(task => task.id)) + 1, task: line.task, division: plan.division, unit: inpatient ? "day" : line.unit, type: line.type ?? "Saved activity", cu: line.libraryCu, days: inpatient ? 1 : line.libraryDays ?? .5, serviceWeekDays: inpatient ? line.libraryServiceWeekDays ?? 5 : undefined }); } });
    if (nextTasks.length !== taskLibrary.length) setTaskLibrary(nextTasks);
    const nextQty: Record<number,number> = {}, nextOverrides: Record<number,number> = {}, nextDayOverrides: Record<number,number> = {}, nextServiceOverrides: Record<number,number> = {}, nextEnabled: Record<number,boolean> = {};
    plan.lines.forEach(line => { const task=nextTasks.find(item => item.task === line.task && item.division === plan.division); if (task) { nextQty[task.id]=line.quantity; nextEnabled[task.id]=true; if (line.cuOverridden ?? line.overridden) nextOverrides[task.id]=line.appliedCu; if (line.daysOverridden) nextDayOverrides[task.id]=line.appliedDays ?? task.days; if (line.serviceWeekDaysOverridden) nextServiceOverrides[task.id]=line.appliedServiceWeekDays ?? task.serviceWeekDays ?? 5; } });
    setDivision(plan.division); setSelectedId(provider.id); setQuantities(nextQty); setCuOverrides(nextOverrides); setDayOverrides(nextDayOverrides); setServiceWeekOverrides(nextServiceOverrides); setSuggestionEnabled(nextEnabled); setAdjustedFte(plan.adjustedFte ?? 1); setAdjustedFteEnabled((plan.adjustedFte ?? 1) !== 1); setCurrentPlanId(plan.id); setTab("calculator");
  };

  return <main>
    <header className="topbar"><div className="brandmark">cu</div><div><div className="eyebrow">Clinical operations</div><h1>Clinical Unit Planner</h1></div><div className="fiscal">Fiscal year <b>2026</b></div><button className="avatar" aria-label="Account menu">JL</button></header>
    <nav aria-label="Primary navigation">
      <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button>
      <button className={tab === "calculator" ? "active" : ""} onClick={() => setTab("calculator")}>Calculator</button>
      <button className={tab === "approved" ? "active" : ""} onClick={() => setTab("approved")}>Approved plans <span>{savedPlans.length}</span></button>
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
        <div className="stats"><article><span>Planning baseline</span><strong>0 <i>CU</i></strong><small>All providers start clean</small></article><article><span>Units to allocate</span><strong>{totals.target.toFixed(0)}</strong><small>Across {divisionProviders.length} providers</small></article><article><span>Plans approved</span><strong>{savedPlans.filter(plan => plan.division === division).length} <i>/ {divisionProviders.length}</i></strong><small className="good">Saved provider plans</small></article><article><span>Target basis</span><strong>460 <i>CU</i></strong><small>at 100% clinical effort</small></article></div>
        <section className="panel"><div className="panelhead"><div><h2>Provider planning status</h2><p>Every plan begins at zero; targets adjust to clinical effort</p></div><div className="legend"><i className="dot red"/>Not planned <i className="dot green"/>Approved</div></div><ProviderTable providers={divisionProviders} approvedPlans={savedPlans} onPlan={p => { selectProvider(p); setTab("calculator"); }}/></section>
      </>}

      {tab === "calculator" && <div className="calculator-grid">
        <section className="panel calc-main">
          <div className="calc-title"><div><div className="eyebrow">Clinical unit calculator</div><h2>Build a full provider plan</h2><p>Balance the effort-adjusted CU target against annual clinical-day capacity.</p></div><button className="text-button" onClick={() => { setQuantities({}); setCuOverrides({}); setDayOverrides({}); setServiceWeekOverrides({}); setSuggestionEnabled({}); setAdjustedFte(1); setAdjustedFteEnabled(false); }}>Clear plan</button></div>
          <div className="selection-flow">
            <label><span>1</span><b>Division</b><select value={division} onChange={e => switchDivision(e.target.value)}>{divisions.map(d => <option key={d}>{d}</option>)}</select></label>
            <div className="flow-arrow">→</div>
            <label><span>2</span><b>Provider</b><select value={selected?.id ?? ""} onChange={e => { const provider=providerRoster.find(p => p.id === Number(e.target.value)); if (provider) selectProvider(provider); }}><option value="" disabled>Select provider</option>{divisionProviders.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
          </div>
          {selected ? <>
            <div className="target-strip"><div className="selected-person"><i>{initials(selected.name)}</i><div><b>{selected.name}</b><small>{selected.effort}% clinical effort</small></div></div><div><span>Saved planned total</span><b>{savedPlanBeingEdited ? `${savedPlanBeingEdited.plannedCu.toFixed(1)} CU` : "No saved plan"}</b></div><label className="adjusted-fte"><span>Adjusted FTE</span><span className="fte-toggle"><input type="checkbox" checked={adjustedFteEnabled} onChange={e => { setAdjustedFteEnabled(e.target.checked); if (!e.target.checked) setAdjustedFte(1); }}/><i/><small>{adjustedFteEnabled ? "Applied" : "Full year"}</small></span>{adjustedFteEnabled && <input aria-label="Adjusted FTE value" type="number" min="0.01" max="1" step="0.05" value={adjustedFte} onFocus={e => e.currentTarget.select()} onChange={e => setAdjustedFte(e.target.value === "" ? 1 : Math.min(1,Math.max(.01,Number(e.target.value))))}/>}</label><div><span>CU target</span><b>{target}</b></div><div className={excess > 0 ? "gap-box over-gap" : "gap-box"}><span>{excess > 0 ? "Above target" : "Still to assign"}</span><b>{(excess || remaining).toFixed(1)}</b></div></div>
            <div className="assign-block"><div><div className="eyebrow">3 · Plan activities</div><h3>{currentPlanId ? `Edit ${selected.name}’s saved plan` : `Build ${selected.name}’s plan`}</h3><p>All {division} tasks are shown. Quantities start at zero; checkboxes control proposal eligibility.</p></div><div className="proposal-key"><span className="mini-check">✓</span><b>Include in proposals</b><small>Uncheck any task the provider cannot perform.</small></div></div>
            <div className="assignment-list">
              {displayTasks.map(task => { const qty = quantities[task.id] ?? 0, inpatient=isInpatient(task), lockedDays=hasLockedDays(task), appliedCu = cuOverrides[task.id] ?? task.cu, appliedDays = taskDays(task,dayOverrides), appliedServiceWeekDays=serviceWeekOverrides[task.id] ?? task.serviceWeekDays ?? 5, cuChanged = appliedCu !== task.cu, daysChanged = !inpatient && !lockedDays && appliedDays !== task.days, serviceDaysChanged=inpatient && appliedServiceWeekDays !== (task.serviceWeekDays ?? 5), enabled = suggestionEnabled[task.id] ?? false, frequency=schedulableWeeks > 0 ? qty/schedulableWeeks : 0; return <div className={`assignment ${qty > 0 ? "in-plan" : ""} ${enabled ? "enabled" : ""}`} key={task.id}><label className="suggest-check"><input type="checkbox" checked={enabled} onChange={e => setSuggestionEnabled({...suggestionEnabled,[task.id]:e.target.checked})}/><span>✓</span></label><div className="task-name"><b>{task.task}</b><small>{task.type}</small></div><label className={`rate-edit ${cuChanged ? "changed" : ""}`}><span>{cuChanged ? "TEMP CU" : "CU / UNIT"}</span><input aria-label={`${task.task} temporary CU value`} type="number" min="0.01" step="0.01" value={appliedCu} onFocus={e => e.currentTarget.select()} onChange={e => { const value=e.target.value; setCuOverrides({...cuOverrides,[task.id]:value === "" ? task.cu : Math.max(.01,Number(value))}); }}/></label>{inpatient ? <label className={`rate-edit service-week-edit ${serviceDaysChanged ? "changed" : ""}`}><span>{serviceDaysChanged ? "TEMP DAYS/WK" : "SERVICE DAYS/WK"}</span><input aria-label={`${task.task} service days per week`} type="number" min="1" max="7" step="1" value={appliedServiceWeekDays} onFocus={e => e.currentTarget.select()} onChange={e => { const value=e.target.value; setServiceWeekOverrides({...serviceWeekOverrides,[task.id]:value === "" ? task.serviceWeekDays ?? 5 : Math.min(7,Math.max(1,Number(value)))}); }}/></label> : lockedDays ? <div className="fixed-day"><span>DAYS / UNIT</span><b>{appliedDays}</b><small>Fixed</small></div> : <label className={`rate-edit day-edit ${daysChanged ? "changed" : ""}`}><span>{daysChanged ? "TEMP DAYS" : "DAYS / UNIT"}</span><input aria-label={`${task.task} temporary day value`} type="number" min="0.5" step="0.5" value={appliedDays} onFocus={e => e.currentTarget.select()} onChange={e => { const value=e.target.value; setDayOverrides({...dayOverrides,[task.id]:value === "" ? task.days : Math.max(.5,Number(value))}); }}/></label>}<div className="count-control"><span>COUNT · {countUnit(task)}</span><div className="stepper"><button onClick={() => setQuantities({...quantities,[task.id]:Math.max(0,qty-1)})}>−</button><input aria-label={`${task.task} units`} inputMode="numeric" type="number" min="0" placeholder="0" value={qty === 0 ? "" : qty} onChange={e => setQuantities({...quantities,[task.id]:e.target.value === "" ? 0 : Math.max(0,Number(e.target.value))})}/><button onClick={() => setQuantities({...quantities,[task.id]:qty+1})}>+</button></div></div><div className="task-total"><b>{(qty*appliedCu).toFixed(1)} CU</b><small>{(inpatient ? qty : qty*appliedDays).toFixed(1)} days</small></div><div className="schedule-helper"><span>{inpatient ? "SERVICE WEEKS" : "WEEKLY CADENCE"}</span><b>{inpatient ? (qty/appliedServiceWeekDays).toFixed(2) : `${frequency.toFixed(2)} / wk`}</b><small>{inpatient ? `${qty} ÷ ${appliedServiceWeekDays}` : `${qty} across ${schedulableWeeks.toFixed(2)} wk`}</small></div></div> })}
            </div>
          </> : <div className="empty-plan"><b>No providers in this division</b><p>Import the provider roster to begin.</p></div>}
        </section>
        <aside className="calc-aside">
          {selected && <section className="result-card"><div className="eyebrow">Plan completeness</div><div className="ring" style={{"--pct":`${target ? Math.min(100,planned/target*100) : 0}%`} as React.CSSProperties}><div><strong>{target ? Math.round(planned/target*100) : 0}%</strong><span>of target</span></div></div><div className="result-row"><span>{currentPlanId ? "Saved plan" : "Planned total"}</span><b>{planned.toFixed(1)} CU</b></div><div className="result-row total"><span>{remaining ? "Still needed" : excess ? "Above target" : "Target reached"}</span><b>{remaining ? `${remaining.toFixed(1)} CU` : excess ? `+${excess.toFixed(1)} CU` : "✓"}</b></div><button className="primary" disabled={planned < target || saving} onClick={savePlan}>{saving ? "Saving…" : planned < target ? "Complete plan to save" : currentPlanId ? "Save plan changes" : "Approve & save plan"}</button>{(Object.keys(cuOverrides).some(id => cuOverrides[Number(id)] !== taskLibrary.find(t => t.id === Number(id))?.cu) || Object.keys(dayOverrides).some(id => !hasLockedDays(taskLibrary.find(t => t.id === Number(id)) ?? seedTasks[0]) && dayOverrides[Number(id)] !== taskLibrary.find(t => t.id === Number(id))?.days) || Object.keys(serviceWeekOverrides).some(id => serviceWeekOverrides[Number(id)] !== taskLibrary.find(t => t.id === Number(id))?.serviceWeekDays)) && <div className="override-warning">⚑ Temporary CU, day, or service-week values will be flagged in the saved record.</div>}</section>}
          {selected && <section className={`burn-card ${capacityRemainingDays < 0 ? "over" : ""}`}><div className="burn-head"><div><div className="eyebrow">Annual clinical capacity</div><h3>{Math.abs(capacityRemainingDays).toFixed(1)} days {capacityRemainingDays < 0 ? "over" : "open"}</h3></div><strong>{plannedDays.toFixed(1)} / {capacityDays.toFixed(1)} <small>clinical days planned · {capacityPct.toFixed(0)}%</small></strong></div><div className="capacity-bar"><i className="inpatient-burn" style={{width:`${capacityDays ? Math.min(inpatientDays/capacityDays*100,100) : 0}%`}}/><i className="outpatient-burn" style={{width:`${capacityDays ? Math.min(outpatientDays/capacityDays*100,Math.max(0,100-inpatientDays/capacityDays*100)) : 0}%`}}/><i className="procedural-burn" style={{width:`${capacityDays ? Math.min(proceduralDays/capacityDays*100,Math.max(0,100-(inpatientDays+outpatientDays)/capacityDays*100)) : 0}%`}}/><i className="ancillary-burn" style={{width:`${capacityDays ? Math.min(ancillaryDays/capacityDays*100,Math.max(0,100-(inpatientDays+outpatientDays+proceduralDays)/capacityDays*100)) : 0}%`}}/></div><div className="capacity-scale"><span>0 days</span><span>{selected.effort}% cFTE × {appliedAdjustedFte.toFixed(2)} adjusted FTE</span><span>{capacityDays.toFixed(1)} days</span></div><div className="capacity-legend"><span><i className="inpatient-burn"/>Inpatient <b>{inpatientDays.toFixed(1)} days</b></span><span><i className="outpatient-burn"/>Outpatient & precepting <b>{outpatientDays.toFixed(1)} days</b></span><span><i className="procedural-burn"/>Procedural <b>{proceduralDays.toFixed(1)} days</b></span><span><i className="ancillary-burn"/>Ancillary & other <b>{ancillaryDays.toFixed(1)} days</b></span></div>{capacityRemainingDays < 0 && <div className="capacity-alert">Clinical capacity exceeded by {Math.abs(capacityRemainingDays).toFixed(1)} days</div>}</section>}
          {selected && <section className="proposals"><div className="proposal-head"><div className="bulb">✦</div><div><div className="eyebrow">Proposed methods</div><h3>{remaining ? `Ways to add ${remaining.toFixed(1)} CU` : excess ? `Ways to reduce ${excess.toFixed(1)} CU` : "Plan is balanced"}</h3></div></div>{remaining ? <><p>Every enabled task is shown. Select an option to add it to the plan.</p>{proposalTasks.length ? proposalTasks.map(task => { const rate=cuOverrides[task.id] ?? task.cu, inpatient=isInpatient(task), dayRate=inpatient ? 1 : taskDays(task,dayOverrides), serviceDays=serviceWeekOverrides[task.id] ?? task.serviceWeekDays ?? 5, count = Math.ceil(remaining / rate), proposalFrequency=schedulableWeeks > 0 ? count/schedulableWeeks : 0; return <button className="proposal" key={task.id} onClick={() => setQuantities({...quantities,[task.id]:(quantities[task.id] ?? 0)+count})}><span><b>Add {count} {plural(task.unit,count)}</b><small>{task.task} · {inpatient ? `${(count/serviceDays).toFixed(2)} service weeks` : `${(count*dayRate).toFixed(1)} days · ${proposalFrequency.toFixed(2)}/week`}</small></span><strong>+{(count*rate).toFixed(1)} CU</strong><i>Use plan →</i></button> }) : <small>Enable at least one division task to generate options.</small>}</> : excess ? <><p>Reductions stop at the closest whole-unit plan at or above the target.</p>{proposalTasks.filter(task => (quantities[task.id] ?? 0) > 0 && Math.floor(excess/(cuOverrides[task.id] ?? task.cu)) > 0).length ? proposalTasks.filter(task => (quantities[task.id] ?? 0) > 0 && Math.floor(excess/(cuOverrides[task.id] ?? task.cu)) > 0).map(task => { const rate=cuOverrides[task.id] ?? task.cu, current=quantities[task.id] ?? 0, count=Math.min(current,Math.floor(excess/rate)), releasedDays=count*(isInpatient(task) ? 1 : taskDays(task,dayOverrides)), revised=planned-count*rate; return <button className="proposal reduce" key={task.id} onClick={() => setQuantities({...quantities,[task.id]:current-count})}><span><b>Remove {count} {plural(task.unit,count)}</b><small>{task.task} · releases {releasedDays.toFixed(1)} days · plan becomes {(revised/target*100).toFixed(1)}%</small></span><strong>−{(count*rate).toFixed(1)} CU</strong><i>Use reduction →</i></button> }) : <small>This is already the closest whole-unit plan at or above the target. Enable another assigned task to explore more reductions.</small>}</> : <p className="balanced-note">The plan meets the CU target exactly. You can still adjust any activity above.</p>}</section>}
        </aside>
      </div>}

      {tab === "approved" && <section className="approved-view">
        <div className="records-head"><div><div className="eyebrow">Saved records</div><h2>Approved provider plans</h2><p>Complete CU plans with a permanent record of any temporary rate adjustments.</p></div><button className="primary" onClick={() => setTab("calculator")}>＋ Build new plan</button></div>
        {savedPlans.length ? <div className="plan-records">{savedPlans.map(plan => <article className="plan-record" key={plan.id}>
          <div className="record-top"><div className="record-person"><i>{initials(plan.providerName)}</i><div><h3>{plan.providerName}</h3><p>{plan.division} · {plan.clinicalEffort}% clinical effort</p></div></div><div className="record-badges"><span className="approved-badge">✓ Approved</span>{plan.hasOverrides && <span className="override-badge">⚑ Temporary value</span>}</div></div>
          <div className="record-metrics"><div><span>Target</span><b>{plan.targetCu} CU</b></div><div><span>Planned</span><b>{plan.plannedCu.toFixed(1)} CU</b></div><div><span>Adjusted FTE</span><b>{(plan.adjustedFte ?? 1).toFixed(2)}</b></div><button className="edit-record" onClick={() => editPlan(plan)}>Edit in calculator →</button></div>
          <div className="record-lines">{plan.lines.map((line, index) => { const inpatient=(line.type ?? "").toLowerCase().includes("inpatient"); return <div key={`${line.task}-${index}`}><span><b>{line.task}</b><small>{line.quantity} {plural(line.unit,line.quantity)}</small></span><span className={line.overridden ? "flagged-rate" : ""}>{line.appliedCu} CU · {inpatient ? `${line.appliedServiceWeekDays ?? 5} service days/wk` : `${line.appliedDays ?? "—"} days/${line.unit}`}{line.overridden && <small>Library: {line.libraryCu} CU · {inpatient ? `${line.libraryServiceWeekDays ?? 5} service days/wk` : `${line.libraryDays ?? "—"} days`}</small>}</span><strong>{line.totalCu.toFixed(1)} CU<small>{line.totalDays?.toFixed(1) ?? "—"} days</small></strong></div>})}</div>
        </article>)}</div> : <div className="panel empty-records"><div>✓</div><h3>No approved plans yet</h3><p>Build a provider’s full plan to their target, then approve and save it here.</p><button className="primary" onClick={() => setTab("calculator")}>Open calculator</button></div>}
      </section>}

      {tab === "library" && <section className="panel library"><div className="panelhead"><div><h2>Clinical task library</h2><p>CU and capacity values available to the {division} calculator</p></div><div className="library-actions"><input placeholder="Search tasks" value={search} onChange={e => setSearch(e.target.value)}/><button className="primary" onClick={() => taskFileRef.current?.click()}>Import task CSV</button></div></div><div className="schema-note"><b>CSV columns</b><span>Task</span><span>Clinical unit</span><span>Days per task</span><span>Service days per week</span><span>Unit</span><span>Task type</span><span>Division</span><em>Procedural work is fixed at 0.5 day/block; outpatient and precepting day values are locked.</em></div><div className="task-table"><div className="task-row labels"><span>Task</span><span>CU value</span><span>Days</span><span>Service days/wk</span><span>Unit</span><span>Task type</span><span>Division</span></div>{divisionTasks.filter(t => t.task.toLowerCase().includes(search.toLowerCase())).map(t => <div className="task-row" key={t.id}><span><b>{t.task}</b></span><span className="cu-pill">{t.cu}</span><span className="day-pill">{isProcedural(t) ? .5 : t.days}</span><span>{isInpatient(t) ? t.serviceWeekDays ?? 5 : "—"}</span><span>{isProcedural(t) ? "half-day block" : t.unit}</span><span>{t.type}</span><span>{t.division}</span></div>)}</div></section>}

      {tab === "providers" && <section className="panel roster"><div className="panelhead"><div><h2>Provider roster</h2><p>Doctors available to the {division} calculator · every provider starts at 0 CU</p></div><button className="primary" onClick={() => providerFileRef.current?.click()}>Import provider CSV</button></div><div className="schema-note"><b>Required CSV columns</b><span>Name</span><span>Division</span><span>Clinical effort</span></div><ProviderTable providers={divisionProviders} approvedPlans={savedPlans} onPlan={p => { selectProvider(p); setTab("calculator"); }}/></section>}
    </section>
    <footer><span>Clinical Unit Planner</span><span>Targets are planning estimates and should be reviewed against approved divisional policy.</span></footer>
  </main>;
}

function ProviderTable({ providers, approvedPlans, onPlan }: { providers: Provider[]; approvedPlans: SavedPlan[]; onPlan: (provider: Provider) => void }) {
  return <div className="table provider-table"><div className="tr labels"><span>Provider</span><span>Effort</span><span>CU target</span><span>Status</span><span></span></div>{providers.map(p => { const target=targetFor(p.effort), approved=approvedPlans.some(plan => plan.providerName === p.name && plan.division === p.division); return <div className="tr" key={p.id}><span className="person"><i>{initials(p.name)}</i><b>{p.name}<small>{p.division}</small></b></span><span className="effort">{p.effort}%</span><span className="progress"><b>0 <small>/ {target} CU</small></b><em><u className={approved ? "greenbar" : "redbar"} style={{width:approved ? "100%" : "0%"}}/></em><small>{approved ? "Full plan approved" : `${target} CU to allocate`}</small></span><span><mark className={approved ? "on" : "behind"}>{approved ? "Approved" : "Not planned"}</mark></span><button className="arrow" onClick={() => onPlan(p)} aria-label={`Open calculator for ${p.name}`}>→</button></div>})}{!providers.length && <div className="empty-plan"><b>No providers in this division</b><p>Import a provider CSV to add the roster.</p></div>}</div>;
}

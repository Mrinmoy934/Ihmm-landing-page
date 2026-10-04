import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Ship,
    FileText,
    TrendingUp,
    AlertTriangle,
    Filter,
    Activity,
    Clock,
    ChevronRight,
    ArrowUpRight,
    ArrowRight,
    ExternalLink,
    Download,
    Search,
    X,
    ChevronDown,
    RefreshCw,
    Calendar
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/apiClient';
import { ENDPOINTS } from '../../config/api.config';
import type { Vessel, AuditSummary, DashboardFilters, DashboardOverviewData, DashboardLineItem } from '../../types';
import './Dashboard.css';

import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip as RTooltip,
  PieChart, Pie,
} from "recharts";

const TEAL = "#0d9488";
const CYAN = "#00B0FA";
const INK = "#0f2c40";

// 16 IHM Table A/B hazardous materials tracked across the fleet
const BASE_MATERIALS = [
  { key: "Asbestos", color: "#2563eb" },
  { key: "Polychlorinated Biphenyls (PCB)", color: "#0891b2" },
  { key: "Ozone Depleting Substance", color: "#14b8a6" },
  { key: "Organotin Compounds", color: "#22c55e" },
  { key: "Cybutryne", color: "#84cc16" },
  { key: "Cadmium (and compounds)", color: "#f59e0b" },
  { key: "Chromium (and compounds)", color: "#b91c1c" },
  { key: "Lead (and compounds)", color: "#92400e" },
  { key: "Mercury (and compounds)", color: "#78716c" },
  { key: "Polybrominated Biphenyl (PBB)", color: "#c084fc" },
  { key: "Polybrominated Diphenyl Ethers (PBDE)", color: "#38bdf8" },
  { key: "Polychloronaphthalenes (Cl ≥ 3)", color: "#db2777" },
  { key: "Radioactive Material", color: "#a3e635" },
  { key: "Certain Shortchain Chlorinated Paraffins", color: "#16a34a" },
  { key: "Perfluorooctane Sulfonic Acid (PFOS)", color: "#fca5a5" },
  { key: "Hexabromocyclododecane (HBCDD)", color: "#f472b6" },
];

const QUARTERS = [
  "Q1-22", "Q2-22", "Q3-22", "Q4-22",
  "Q1-23", "Q2-23", "Q3-23", "Q4-23",
  "Q1-24", "Q2-24", "Q3-24", "Q4-24",
  "Q1-25", "Q2-25", "Q3-25", "Q4-25"
];

const HM_STATUSES = ["HM Red", "HM Green", "Non HM"];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    "HM Red": "bg-red-50 text-red-700 ring-red-200",
    "HM Green": "bg-emerald-50 text-emerald-700 ring-emerald-200",
    "Non HM": "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${map[status] || map["Non HM"]}`}>
      {status}
    </span>
  );
}

function Donut({ data, total, caption, sub }: { data: Array<{ name: string; value: number; color: string }>; total: string; caption: string; sub: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[132px] w-[132px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-800">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{sub}</span>
        </div>
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-600 m-0">{caption}</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((d, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
            {d.name}: <strong className="text-slate-700">{d.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-slate-200 border-solid">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 bg-transparent border-0 cursor-pointer">
        {title}
        <ChevronDown size={14} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-1.5 border-0 border-t border-slate-100 border-solid px-3 py-2.5">{children}</div>}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" checked={checked} onChange={onChange}
        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-500 focus:ring-sky-400" />
      {label}
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-50 pb-2">
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700 font-medium text-xs">{value}</dd>
    </div>
  );
}

/* =========================================================================
 * 1. VESSEL, SHIP OWNER & SHIP MANAGER DYNAMIC DASHBOARD CONTENT (100% REAL DB)
 * ========================================================================= */
function OwnerManagerVesselDashboardContent() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const [metric, setMetric] = useState("ships"); // ships | items
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DashboardLineItem | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<string | null>(null);
  
  // Quarter Selection Logic
  const [isAllTime, setIsAllTime] = useState<boolean>(false);
  const [range, setRange] = useState<[number, number]>([0, QUARTERS.length - 1]);

  // Checkbox & Search filters
  const [fShips, setFShips] = useState<string[]>([]);
  const [fFlags, setFFlags] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [colSearch, setColSearch] = useState<Record<string, string>>({});

  // Dynamic API states
  const [overviewData, setOverviewData] = useState<DashboardOverviewData | null>(null);
  const [inventoryItems, setInventoryItems] = useState<DashboardLineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const startQuarter = isAllTime ? '' : QUARTERS[range[0]];
  const endQuarter = isAllTime ? '' : QUARTERS[range[1]];

  // Fetch live overview and inventory data from MongoDB backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const params: Record<string, string> = {};
    if (!isAllTime) {
      params.startQuarter = startQuarter;
      params.endQuarter = endQuarter;
    }

    Promise.all([
      api.get<{ success: boolean; data: DashboardOverviewData }>(ENDPOINTS.DASHBOARD.OVERVIEW, params),
      api.get<{ success: boolean; data: { items: DashboardLineItem[] } }>(ENDPOINTS.DASHBOARD.INVENTORY, { ...params, limit: 100 })
    ]).then(([overviewRes, inventoryRes]) => {
      if (!isMounted) return;
      if (overviewRes.data) {
        setOverviewData(overviewRes.data);
      }
      if (inventoryRes.data?.items) {
        setInventoryItems(inventoryRes.data.items);
      }
    }).catch(err => {
      console.error('Failed to load dynamic dashboard data from DB:', err);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [isAllTime, startQuarter, endQuarter]);

  const vesselsList = useMemo(() => {
    if (overviewData?.options.vessels && overviewData.options.vessels.length > 0) {
      return overviewData.options.vessels.map(v => v.name);
    }
    return Array.from(new Set(inventoryItems.map(i => i.ship).filter(Boolean)));
  }, [overviewData, inventoryItems]);

  const flagsList = useMemo(() => {
    if (overviewData?.options.flagStates && overviewData.options.flagStates.length > 0) {
      return overviewData.options.flagStates;
    }
    return Array.from(new Set(inventoryItems.map(i => i.flag).filter(Boolean)));
  }, [overviewData, inventoryItems]);

  const poMetrics = useMemo(() => {
    if (overviewData?.poMetrics) return overviewData.poMetrics;
    return [
      { label: "PO Tracked vs PO Received", a: 0, b: 0, color: TEAL },
      { label: "Item Tracked vs Item Purchased", a: 0, b: 0, color: CYAN },
      { label: "MDs Pending vs Received", a: 0, b: 0, color: "#f59e0b" },
    ];
  }, [overviewData]);

  const mdDonut = useMemo(() => {
    if (overviewData?.mdDonut) return overviewData.mdDonut;
    return [
      { name: "MDs Received", value: 0, color: TEAL },
      { name: "MDs Pending", value: 0, color: "#f59e0b" },
      { name: "SDoCs Received", value: 0, color: CYAN },
      { name: "SDoCs Pending", value: 0, color: "#cbd5e1" },
    ];
  }, [overviewData]);

  const supplierDonut = useMemo(() => {
    if (overviewData?.supplierDonut) return overviewData.supplierDonut;
    return [
      { name: "Responsive", value: 0, color: TEAL },
      { name: "Non-Responsive", value: 0, color: "#f59e0b" },
      { name: "Pending", value: 0, color: "#cbd5e1" },
    ];
  }, [overviewData]);

  const toggle = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // Compute 16 Hazmat Bar Data dynamically from backend overview / DB inventory
  const barData = useMemo(() => {
    const hazmatMap = new Map((overviewData?.hazmatBreakdown || []).map(h => [h.key, h]));

    return BASE_MATERIALS.map((m) => {
      const breakdown = hazmatMap.get(m.key);
      const matchingItems = inventoryItems.filter(item => item.hm === m.key || (m.key.includes("PCB") && item.hm?.includes("PCB")));
      
      const itemsCount = breakdown ? breakdown.count : matchingItems.length;
      const shipsCount = breakdown ? breakdown.shipsCount : new Set(matchingItems.map(item => item.ship)).size;

      return {
        ...m,
        ships: shipsCount,
        items: itemsCount,
        value: metric === "ships" ? shipsCount : itemsCount
      };
    });
  }, [metric, overviewData, inventoryItems]);

  const filtered = useMemo(() => {
    return inventoryItems.filter((r) => {
      if (activeMaterial && r.hm !== activeMaterial && !(activeMaterial.includes("PCB") && r.hm?.includes("PCB"))) return false;
      if (fShips.length && !fShips.includes(r.ship)) return false;
      if (fFlags.length && !fFlags.includes(r.flag)) return false;
      if (fStatus.length && !fStatus.includes(r.status)) return false;
      for (const [k, v] of Object.entries(colSearch)) {
        if (v && !String((r as any)[k] ?? "").toLowerCase().includes(v.toLowerCase())) return false;
      }
      return true;
    });
  }, [activeMaterial, fShips, fFlags, fStatus, colSearch, inventoryItems]);

  const activeFilterCount =
    fShips.length + fFlags.length + fStatus.length + (activeMaterial ? 1 : 0) +
    Object.values(colSearch).filter(Boolean).length;

  function exportCSV() {
    if (!filtered.length) return;
    const cols = ["ship", "flag", "vclass", "supplier", "desc", "hm", "qty", "cat", "status", "po", "vs", "created", "updated"];
    const head = ["Ship Name", "Flag", "Vessel Class", "Supplier", "Item Description", "Hazardous Material", "Total Qty", "IHM Category", "HM Status", "PO Number", "VS Product Code", "Created", "Updated"];
    const rows = filtered.map((r) => cols.map((c) => `"${String((r as any)[c] ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [head.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ihm-inventory-export-${isAllTime ? 'all-time' : `${startQuarter}-to-${endQuarter}`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const clearAll = () => {
    setFShips([]); setFFlags([]); setFStatus([]); setColSearch({}); setActiveMaterial(null);
  };

  // Quarter Click Selector Logic: single click selects single quarter, shift-click/drag expands range
  const handleQuarterClick = (index: number, e: React.MouseEvent) => {
    setIsAllTime(false);
    if (e.shiftKey) {
      if (index < range[0]) setRange([index, range[1]]);
      else setRange([range[0], index]);
    } else {
      // Direct click on a specific quarter selects ONLY that quarter
      setRange([index, index]);
    }
  };

  return (
    <div className="dashboard-wrapper font-sans text-slate-800" style={{ background: '#f8fafc' }}>
      <Sidebar />

      {/* Main Content Workspace */}
      <main className="main-content flex-1 overflow-hidden" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />

        {/* Top Header bar: Greeting + Timeline Quarters */}
        <header className="border-0 border-b border-slate-200 border-solid bg-white px-5 py-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-800 m-0">Welcome back, {firstName}</h1>
              <p className="text-xs text-slate-500 m-0 mt-0.5">Here's what's happening with your IHM operations today.</p>
            </div>
            <button
              onClick={() => setShowFilters(true)}
              className="relative flex items-center gap-2 rounded-lg bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 border-0 cursor-pointer"
            >
              <Filter size={15} /> Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[11px]">{activeFilterCount}</span>
              )}
            </button>
          </div>

          {/* Quarter Timeline Bar (Q1-22 to Q4-25) */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Calendar size={13} className="text-sky-500" />
                Selected Period: {isAllTime ? (
                  <strong className="text-sky-600">All Time (Full Fleet History)</strong>
                ) : (
                  <strong className="text-slate-800">{startQuarter === endQuarter ? startQuarter : `${startQuarter} to ${endQuarter}`}</strong>
                )}
              </span>
              <button
                onClick={() => setIsAllTime(!isAllTime)}
                className="text-sky-600 bg-transparent border-0 cursor-pointer font-semibold hover:underline"
              >
                {isAllTime ? "Filter by Quarter" : "View All Time"}
              </button>
            </div>
            {!isAllTime && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {QUARTERS.map((q, i) => {
                  const active = i >= range[0] && i <= range[1];
                  const isSingle = range[0] === range[1] && range[0] === i;
                  return (
                    <button
                      key={q}
                      onClick={(e) => handleQuarterClick(i, e)}
                      title={`Click to filter strictly by ${q} (Shift+Click to set range)`}
                      className={`group flex-1 min-w-[52px] rounded-md py-1.5 text-[10px] font-semibold border-0 cursor-pointer transition ${
                        isSingle
                          ? "bg-sky-600 text-white ring-2 ring-sky-300 shadow-sm"
                          : active
                          ? "bg-sky-500 text-white shadow-xs"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          {/* Charts row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Bar chart */}
            <section className="rounded-xl border border-slate-200 border-solid bg-white p-4 shadow-sm xl:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 m-0">Hazardous Materials Across Fleet</h2>
                  <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                    {metric === "ships"
                      ? "Number of vessels containing each material"
                      : "Number of hazardous line items per material"}
                    {activeMaterial && (
                      <button onClick={() => setActiveMaterial(null)} className="ml-2 text-sky-600 bg-transparent border-0 cursor-pointer hover:underline font-semibold">
                        · clear “{activeMaterial}” filter ✕
                      </button>
                    )}
                  </p>
                </div>
                {/* Metric toggle */}
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setMetric("ships")}
                    className={`rounded-md px-3 py-1 border-0 cursor-pointer transition ${metric === "ships" ? "bg-white text-sky-600 shadow-sm" : "bg-transparent text-slate-500"}`}
                  >Ships</button>
                  <button
                    onClick={() => setMetric("items")}
                    className={`rounded-md px-3 py-1 border-0 cursor-pointer transition ${metric === "items" ? "bg-white text-sky-600 shadow-sm" : "bg-transparent text-slate-500"}`}
                  >HMs</button>
                </div>
              </div>

              <div className="h-[460px] w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    <RefreshCw size={18} className="animate-spin text-sky-500 mr-2" /> Querying database for {isAllTime ? 'All Time' : `${startQuarter} - ${endQuarter}`}...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={3}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category" dataKey="key" width={220}
                        tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false}
                      />
                      <RTooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                        formatter={(v) => [v, metric === "ships" ? "Ships" : "Line items"]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(d: any) => setActiveMaterial((d && d.key) === activeMaterial ? null : String(d.key))} cursor="pointer">
                        {barData.map((m, i) => (
                          <Cell key={i} fill={m.color} opacity={activeMaterial && activeMaterial !== m.key ? 0.3 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <p className="mt-1 text-center text-[10px] text-slate-400 m-0">
                {metric === "ships" ? "No. of Ships" : "No. of Line Items"} · click a bar to filter the inventory log below
              </p>
            </section>

            {/* Right rail: PO metrics + donuts */}
            <section className="space-y-4 m-0">
              {/* PO metrics */}
              <div className="rounded-xl border border-slate-200 border-solid bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-slate-800 m-0">Purchase Order Tracking</h2>
                <div className="space-y-3.5">
                  {poMetrics.map((m) => {
                    const pct = Math.min(100, Math.round((m.a / Math.max(m.b, 1)) * 100));
                    return (
                      <div key={m.label}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-600">{m.label}</span>
                          <span className="font-bold text-slate-800">{m.a} <span className="font-normal text-slate-400">/ {m.b}</span></span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: m.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Donuts */}
              <div className="rounded-xl border border-slate-200 border-solid bg-white p-4 shadow-sm">
                <Donut data={mdDonut} total={String(mdDonut.reduce((acc, d) => acc + d.value, 0))} sub="MDs" caption="MDs & SDoCs Request Count" />
              </div>
              <div className="rounded-xl border border-slate-200 border-solid bg-white p-4 shadow-sm">
                <Donut data={supplierDonut} total={String(supplierDonut.reduce((acc, d) => acc + d.value, 0))} sub="Suppliers" caption="Suppliers Status" />
              </div>
            </section>
          </div>

          {/* Line-item table */}
          <section className="mt-4 rounded-xl border border-slate-200 border-solid bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-0 border-b border-slate-100 border-solid px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800 m-0">IHM Inventory — Line Items</h2>
                <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                  Showing <span className="font-semibold text-slate-700">{filtered.length}</span> items for period {isAllTime ? 'All Time' : `${startQuarter} - ${endQuarter}`}
                  {activeFilterCount > 0 && (
                    <button onClick={clearAll} className="ml-2 text-sky-600 bg-transparent border-0 cursor-pointer font-semibold hover:underline">clear all filters</button>
                  )}
                </p>
              </div>
              <button
                onClick={exportCSV}
                disabled={!filtered.length}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 border-solid bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 cursor-pointer transition hover:bg-emerald-100 disabled:opacity-40"
              >
                <Download size={14} /> Export to Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-xs m-0">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 border-0 border-b border-slate-100 border-solid">
                    {[
                      ["", ""], ["ship", "Ship Name"], ["flag", "Flag"], ["vclass", "Vessel Class"],
                      ["supplier", "Supplier"], ["desc", "Item Description"], ["hm", "Hazardous Material"],
                      ["qty", "Total Qty"], ["cat", "IHM Category"], ["status", "HM Status"],
                      ["po", "PO Number"], ["vs", "VS Code"], ["created", "Created"], ["md", "MD"], ["sdoc", "SDoC"],
                    ].map(([k, label]) => (
                      <th key={k || "open"} className="whitespace-nowrap px-3 py-2 font-semibold border-0">
                        {label}
                      </th>
                    ))}
                  </tr>
                  {/* search row */}
                  <tr className="border-0 border-b border-slate-100 border-solid bg-white">
                    <th className="px-3 py-1.5 border-0"></th>
                    {["ship", "flag", "vclass", "supplier", "desc", "hm", "qty", "cat", "status", "po", "vs"].map((k) => (
                      <th key={k} className="px-2 py-1.5 border-0">
                        <div className="flex items-center gap-1 rounded-md border border-slate-200 border-solid bg-slate-50 px-1.5">
                          <Search size={11} className="text-slate-400" />
                          <input
                            value={colSearch[k] || ""}
                            onChange={(e) => setColSearch({ ...colSearch, [k]: e.target.value })}
                            placeholder="search"
                            className="w-full bg-transparent border-0 py-1 text-[11px] outline-none placeholder:text-slate-300"
                          />
                        </div>
                      </th>
                    ))}
                    <th className="border-0" /><th className="border-0" /><th className="border-0" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={15} className="px-3 py-12 text-center text-slate-400 border-0">
                        <RefreshCw size={20} className="animate-spin inline-block text-sky-500 mr-2" /> Querying database inventory...
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="border-0 border-b border-slate-50 border-solid align-top hover:bg-sky-50/40 transition">
                        <td className="px-3 py-2.5 border-0">
                          <button
                            onClick={() => setSelectedRow(r)}
                            title="Open line-item details"
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 border-solid bg-white text-sky-600 cursor-pointer transition hover:bg-sky-600 hover:text-white"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700 border-0">{r.ship}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 border-0">{r.flag}</td>
                        <td className="px-3 py-2.5 text-slate-500 border-0">{r.vclass}</td>
                        <td className="max-w-[160px] px-3 py-2.5 text-slate-500 border-0 truncate">{r.supplier}</td>
                        <td className="max-w-[200px] px-3 py-2.5 text-slate-600 border-0 truncate">{r.desc}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 border-0 font-medium">{r.hm}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 border-0">{r.qty}</td>
                        <td className="max-w-[140px] px-3 py-2.5 text-slate-500 border-0 truncate">{r.cat}</td>
                        <td className="px-3 py-2.5 border-0"><StatusPill status={r.status} /></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 border-0 font-mono text-[11px]">{r.po}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-400 border-0 font-mono text-[11px]">{r.vs}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-400 border-0">{r.created}</td>
                        <td className="px-3 py-2.5 border-0">{r.md ? <FileText size={14} className="text-red-500" /> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2.5 border-0">{r.sdoc ? <FileText size={14} className="text-sky-500" /> : <span className="text-slate-300">—</span>}</td>
                      </tr>
                    ))
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-3 py-10 text-center text-slate-400 border-0">
                        No database inventory records found for period {isAllTime ? 'All Time' : `${startQuarter} - ${endQuarter}`}. Try selecting a different quarter or clearing active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Filters slide-in */}
      {showFilters && (
        <div className="fixed inset-0 z-[10000] flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowFilters(false)} />
          <div className="flex w-80 flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-0 border-b border-slate-100 border-solid px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800 m-0">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-slate-400 bg-transparent border-0 cursor-pointer hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <FilterGroup title="Vessel">
                {vesselsList.length > 0 ? (
                  vesselsList.map((s) => (
                    <Check key={s} label={s} checked={fShips.includes(s)} onChange={() => toggle(fShips, setFShips, s)} />
                  ))
                ) : (
                  <p className="text-xs text-slate-400 m-0 py-1">No vessel found in DB</p>
                )}
              </FilterGroup>
              <FilterGroup title="Flag State">
                {flagsList.length > 0 ? (
                  flagsList.map((f) => (
                    <Check key={f} label={f} checked={fFlags.includes(f)} onChange={() => toggle(fFlags, setFFlags, f)} />
                  ))
                ) : (
                  <p className="text-xs text-slate-400 m-0 py-1">No flag state found in DB</p>
                )}
              </FilterGroup>
              <FilterGroup title="HM Status">
                {HM_STATUSES.map((s) => (
                  <Check key={s} label={s} checked={fStatus.includes(s)} onChange={() => toggle(fStatus, setFStatus, s)} />
                ))}
              </FilterGroup>
            </div>
            <div className="flex gap-2 border-0 border-t border-slate-100 border-solid p-4">
              <button onClick={clearAll} className="flex-1 rounded-lg border border-slate-200 border-solid py-2 text-sm font-semibold text-slate-600 bg-white cursor-pointer hover:bg-slate-50">Clear all</button>
              <button onClick={() => setShowFilters(false)} className="flex-1 rounded-lg bg-sky-500 border-0 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-sky-600">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Line-item detail drawer */}
      {selectedRow && (
        <div className="fixed inset-0 z-[10001] flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedRow(null)} />
          <div className="flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: INK }}>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-sky-300 m-0 font-semibold">Line-item detail</p>
                <h3 className="text-base font-bold m-0 mt-0.5 text-white">{selectedRow.equip || selectedRow.desc}</h3>
              </div>
              <button onClick={() => setSelectedRow(null)} className="text-slate-300 bg-transparent border-0 cursor-pointer hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm">
              <div className="mb-4 flex items-center gap-2">
                <StatusPill status={selectedRow.status} />
                <span className="flex items-center gap-1 text-xs text-sky-600 font-semibold">
                  <ArrowRight size={13} /> {selectedRow.deck}
                </span>
              </div>
              <dl className="space-y-3 m-0">
                <Field label="IHM Part" value={selectedRow.part} />
                <Field label="Equipment Class / Category" value={selectedRow.cat} />
                <Field label="Suspected Hazardous Material" value={selectedRow.hm} />
                <Field label="Ship" value={`${selectedRow.ship} · ${selectedRow.flag}`} />
                <Field label="Ship PO" value={selectedRow.po} />
                <Field label="Supplier" value={selectedRow.supplier} />
                <Field label="Equipment Name" value={selectedRow.desc} />
                <Field label="Position" value={selectedRow.position} />
                <Field label="Component" value={selectedRow.component} />
                <Field label="Material" value={selectedRow.material} />
                <Field label="Total Quantity of HM" value={selectedRow.qty} />
                <Field label="Remarks" value={selectedRow.remarks} />
              </dl>
              <div className="mt-5 flex gap-2">
                <span className={`flex items-center gap-1.5 rounded-lg border border-solid px-3 py-2 text-xs font-semibold ${selectedRow.md ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  <FileText size={13} /> MD {selectedRow.md ? "attached" : "pending"}
                </span>
                <span className={`flex items-center gap-1.5 rounded-lg border border-solid px-3 py-2 text-xs font-semibold ${selectedRow.sdoc ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  <FileText size={13} /> SDoC {selectedRow.sdoc ? "attached" : "pending"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
 * 2. EXCLUSIVE ADMIN DASHBOARD CONTENT (ORIGINAL UNTOUCHED ADMIN UI/UX)
 * ========================================================================= */
function AdminDashboardContent() {
    const { user } = useAuth();
    const firstName = user?.name?.split(' ')[0] || 'there';

    const [activeFilters, setActiveFilters] = useState<DashboardFilters>({
        yearly: 'Yearly',
        shipOwner: 'Ship Owner',
        shipManager: 'Ship Manager',
        supplier: 'Supplier',
        vessel: 'Vessel'
    });

    const [vesselList, setVesselList] = useState<Vessel[]>([]);
    const [auditRegistry, setAuditRegistry] = useState<AuditSummary[]>([]);

    useEffect(() => {
        api.get<{ success: boolean; data: Vessel[] }>(ENDPOINTS.VESSELS.LIST)
            .then((res) => setVesselList(res.data || []))
            .catch(() => setVesselList([]));

        api.get<{ success: boolean; data: Array<Record<string, unknown>> }>(ENDPOINTS.AUDITS.ACTIVE)
            .then((res) => {
                const rows: AuditSummary[] = (res.data || []).map((a) => ({
                    id: a.id as string | undefined,
                    vesselName: String(a.vesselName ?? ''),
                    imoNumber: String(a.imoNumber ?? ''),
                    totalPO: Number(a.totalPO ?? 0),
                    totalItems: Number(a.totalItems ?? 0),
                    createDate: typeof a.createdAt === 'string' ? a.createdAt.split('T')[0] : '',
                    status: a.status as AuditSummary['status'],
                }));
                setAuditRegistry(rows);
            })
            .catch(() => setAuditRegistry([]));
    }, []);

    const totalVessels = vesselList.length;
    const totalPOs = auditRegistry.reduce((acc, curr) => acc + (curr.totalPO || 0), 0);
    const totalItems = auditRegistry.reduce((acc, curr) => acc + (curr.totalItems || 0), 0);

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = (name: string) => {
        setOpenDropdown(openDropdown === name ? null : name);
    };

    const handleSelect = (filterName: string, value: string) => {
        setActiveFilters(prev => ({ ...prev, [filterName]: value }));
        setOpenDropdown(null);
    };

    return (
        <div className="dashboard-wrapper">
            <Sidebar />

            <main className="main-content">
                <Header />

                <div className="dashboard-content">

                    {/* 1. Welcome & Header */}
                    <div className="header-section">
                        <div className="welcome-text">
                            <h1>Welcome back, {firstName}</h1>
                            <p>Here's what's happening with your IHM operations today.</p>
                        </div>
                    </div>

                    {/* 2. Filters Row */}
                    <div className="filters-row" ref={filterRef}>
                        <button className="filter-btn">
                            <Filter size={16} /> Filters
                        </button>

                        {/* Yearly Filter */}
                        <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                            <div
                                className={`filter-btn ${openDropdown === 'yearly' ? 'active' : ''}`}
                                onClick={() => toggleDropdown('yearly')}
                            >
                                {activeFilters.yearly}
                            </div>
                            {openDropdown === 'yearly' && (
                                <div className="custom-dropdown-menu">
                                    {['Yearly', '2024', '2023', '2022'].map(option => (
                                        <div
                                            key={option}
                                            className={`custom-dropdown-item ${activeFilters.yearly === option ? 'active' : ''}`}
                                            onClick={() => handleSelect('yearly', option)}
                                        >
                                            {option}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ship Owner Filter */}
                        <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                            <div
                                className={`filter-btn ${openDropdown === 'shipOwner' ? 'active' : ''}`}
                                onClick={() => toggleDropdown('shipOwner')}
                            >
                                {activeFilters.shipOwner}
                            </div>
                            {openDropdown === 'shipOwner' && (
                                <div className="custom-dropdown-menu">
                                    {['Ship Owner', 'CMA CGM', 'Maersk Line', 'MSC'].map(option => (
                                        <div
                                            key={option}
                                            className={`custom-dropdown-item ${activeFilters.shipOwner === option ? 'active' : ''}`}
                                            onClick={() => handleSelect('shipOwner', option)}
                                        >
                                            {option}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ship Manager Filter */}
                        <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                            <div
                                className={`filter-btn ${openDropdown === 'shipManager' ? 'active' : ''}`}
                                onClick={() => toggleDropdown('shipManager')}
                            >
                                {activeFilters.shipManager}
                            </div>
                            {openDropdown === 'shipManager' && (
                                <div className="custom-dropdown-menu">
                                    {['Ship Manager', 'V.Ships', 'Bernhard Schulte', 'Columbia Shipmanagement'].map(option => (
                                        <div
                                            key={option}
                                            className={`custom-dropdown-item ${activeFilters.shipManager === option ? 'active' : ''}`}
                                            onClick={() => handleSelect('shipManager', option)}
                                        >
                                            {option}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Supplier Filter */}
                        <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                            <div
                                className={`filter-btn ${openDropdown === 'supplier' ? 'active' : ''}`}
                                onClick={() => toggleDropdown('supplier')}
                            >
                                {activeFilters.supplier}
                            </div>
                            {openDropdown === 'supplier' && (
                                <div className="custom-dropdown-menu">
                                    {['Supplier', 'Wilhelmsen', 'Wärtsilä', 'ABB'].map(option => (
                                        <div
                                            key={option}
                                            className={`custom-dropdown-item ${activeFilters.supplier === option ? 'active' : ''}`}
                                            onClick={() => handleSelect('supplier', option)}
                                        >
                                            {option}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vessel Filter */}
                        <div className="custom-select-wrapper" style={{ position: 'relative' }}>
                            <div
                                className={`filter-btn ${openDropdown === 'vessel' ? 'active' : ''}`}
                                onClick={() => toggleDropdown('vessel')}
                            >
                                {activeFilters.vessel}
                            </div>
                            {openDropdown === 'vessel' && (
                                <div className="custom-dropdown-menu">
                                    {['Vessel', 'MV Ocean Pioneer', 'ACOSTA', 'PACIFIC HORIZON'].map(option => (
                                        <div
                                            key={option}
                                            className={`custom-dropdown-item ${activeFilters.vessel === option ? 'active' : ''}`}
                                            onClick={() => handleSelect('vessel', option)}
                                        >
                                            {option}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="clear-filters" onClick={() => setActiveFilters({
                            yearly: 'Yearly',
                            shipOwner: 'Ship Owner',
                            shipManager: 'Ship Manager',
                            supplier: 'Supplier',
                            vessel: 'Vessel'
                        })}>Clear Filters</button>
                    </div>

                    {/* 3. KPI Cards */}
                    <div className="kpi-grid">
                        <div className="kpi-card blue-gradient">
                            <div className="kpi-top">
                                <span className="kpi-label">Total Vessels</span>
                                <div className="kpi-icon-box">
                                    <Ship size={24} />
                                </div>
                            </div>
                            <div className="kpi-value">{totalVessels}</div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-top">
                                <span className="kpi-label">Active POs</span>
                                <div className="kpi-icon-box">
                                    <FileText size={24} color="#00B0FA" />
                                </div>
                            </div>
                            <div className="kpi-middle">
                                <div className="kpi-value">{totalPOs}</div>
                                <div className="kpi-trend up">
                                    <TrendingUp size={16} /> {auditRegistry.length > 0 ? 'Live' : '0%'}
                                </div>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-top">
                                <span className="kpi-label">Total Items Audit</span>
                                <div className="kpi-icon-box green">
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                            <div className="kpi-middle">
                                <div className="kpi-value">{totalItems}</div>
                                <div className="kpi-trend up">
                                    <TrendingUp size={16} /> Verified
                                </div>
                            </div>
                        </div>

                        <div className="kpi-card">
                            <div className="kpi-top">
                                <span className="kpi-label">Pending Audits</span>
                                <div className="kpi-icon-box orange">
                                    <AlertTriangle size={24} />
                                </div>
                            </div>
                            <div className="kpi-value">{auditRegistry.length}</div>
                        </div>
                    </div>

                    {/* 4. Content Split */}
                    <div className="content-split">
                        <div className="left-column">
                            {/* Recent Activity */}
                            <div className="section-card">
                                <div className="card-title">
                                    <div className="title-icon blue-bg">
                                        <Activity size={18} />
                                    </div>
                                    <h3>Recent Activity</h3>
                                </div>
                                <div className="activity-list">
                                    {auditRegistry.slice(0, 3).map((item, idx) => (
                                        <div key={idx} className="activity-item">
                                            <div className="act-icon blue">
                                                <FileText size={20} />
                                            </div>
                                            <div className="act-content">
                                                <h4>Audit Initialized</h4>
                                                <p>{item.totalPO} POs for {item.vesselName} sent to registry</p>
                                                <span className="act-time">{item.createDate || 'Recently'}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {auditRegistry.length === 0 && (
                                        <div className="summary-empty" style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                                            No recent activity found. Start by uploading a Purchase Order.
                                        </div>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <a href="#" className="view-all-link">View All Activity →</a>
                                </div>
                            </div>
                        </div>

                        <div className="right-column">
                            {/* Vessels */}
                            <div className="section-card">
                                <div className="card-title">
                                    <div className="title-icon blue-bg">
                                        <Ship size={18} />
                                    </div>
                                    <h3>Vessel Registry</h3>
                                </div>
                                <div className="vessels-color-grid">
                                    <div className="v-color-card v-green">
                                        <div className="v-top"><TrendingUp size={14} /> Total</div>
                                        <div className="v-count">{vesselList.length}</div>
                                        <div className="v-sub">&bull; Fleet</div>
                                    </div>
                                    <div className="v-color-card v-red">
                                        <div className="v-top"><AlertTriangle size={14} /> In Audit</div>
                                        <div className="v-count">{auditRegistry.length}</div>
                                        <div className="v-sub">Phase</div>
                                    </div>
                                    <div className="v-color-card v-blue">
                                        <div className="v-top"><ArrowUpRight size={14} /> Managers</div>
                                        <div className="v-count">{new Set(vesselList.map(v => v.shipManager)).size}</div>
                                        <div className="v-sub">Active</div>
                                    </div>
                                    <div className="v-color-card v-purple">
                                        <div className="v-top"><ArrowUpRight size={14} /> New</div>
                                        <div className="v-count">0</div>
                                        <div className="v-sub">Pending</div>
                                    </div>
                                </div>
                            </div>

                            {/* SOC Status */}
                            <div className="section-card">
                                <div className="card-title">
                                    <div className="title-icon orange-bg">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <h3>Vessel Status</h3>
                                        <div style={{ fontSize: 11, color: '#98A2B3' }}>Review and Onboarding</div>
                                    </div>
                                </div>
                                <div className="soc-list">
                                    {vesselList.slice(0, 4).map((v, i) => (
                                        <div key={i} className="soc-item">
                                            <div className="soc-left">
                                                <div className="soc-icon"><Ship size={20} /></div>
                                                <div className="soc-info">
                                                    <h4>{v.name}</h4>
                                                    <p>IMO: {v.imoNumber}</p>
                                                </div>
                                            </div>
                                            <div className="soc-right">
                                                <span className="soc-date-label">Created</span>
                                                <span className="soc-date-val">{v.keelLaidDate || 'N/A'}</span>
                                                <span className="soc-badge badge-green">Onboarded</span>
                                            </div>
                                        </div>
                                    ))}
                                    {vesselList.length === 0 && (
                                        <div className="summary-empty" style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                                            No vessels registered.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. Operational Overview Table */}
                    <div className="section-card ops-table-container">
                        <div className="ops-table-header">
                            <h3>Operational Overview - Pending Audits</h3>
                            <p>Track purchase orders awaiting audit across your fleet</p>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ops-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 60 }}></th>
                                        <th>IMO NUMBER</th>
                                        <th>VESSEL NAME</th>
                                        <th>TOTAL POS</th>
                                        <th>LINE ITEMS</th>
                                        <th>STATUS</th>
                                        <th>PROGRESS</th>
                                        <th>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditRegistry.map((v, i) => (
                                        <tr key={i}>
                                            <td><div className="chevron-cell"><ChevronRight size={18} /></div></td>
                                            <td className="row-imo">{v.imoNumber}</td>
                                            <td className="row-name">{v.vesselName}</td>
                                            <td>{v.totalPO}</td>
                                            <td>{v.totalItems}</td>
                                            <td><span className="reminder-badge rem-1">Pending</span></td>
                                            <td><div className="reminder-badge rem-good">0%</div></td>
                                            <td>
                                                <div className="chevron-cell">
                                                    <ArrowUpRight size={18} style={{ cursor: 'pointer', color: '#00B0FA' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {auditRegistry.length === 0 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                                                No pending audits in the system.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

/* =========================================================================
 * MAIN DASHBOARD ROUTER
 * ========================================================================= */
export default function Dashboard() {
    const { user } = useAuth();
    
    const isOwnerManagerOrVessel = useMemo(() => {
        if (!user) return false;
        const role = (user.roleName || user.role || user.category || '').toLowerCase();
        return role === 'owner' || role === 'ship_owner' || role === 'ship_manager' || role === 'vessel' ||
               role.includes('owner') || role.includes('manager') || role.includes('vessel');
    }, [user]);

    if (isOwnerManagerOrVessel) {
        return <OwnerManagerVesselDashboardContent />;
    }

    return <AdminDashboardContent />;
}

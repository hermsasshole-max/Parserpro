import{c,u as L,r as h,j as e,a5 as u,D as b,a2 as A}from"./index-COCB1RI5.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],R=c("copy",U);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"M12 3v18",key:"108xh3"}],["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M3 15h18",key:"5xshup"}]],g=c("table",_),C=()=>{const{receipts:i,quotes:T,invoices:d,clients:E,inventory:N}=L(),[m,r]=h.useState(null),l=[{tableName:"receipts",description:"Itemized vendor receipts with totals, OCR metadata, and duplicate blocker hash",rowCount:i.length,sql:`CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  vendor_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date TEXT NOT NULL,
  month_year TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Food & Groceries', 'Electricity & Utilities', 'Home Maintenance', 'Transport', 'Other')),
  currency TEXT DEFAULT 'ZAR',
  subtotal REAL DEFAULT 0.0,
  tax REAL DEFAULT 0.0,
  total_amount REAL NOT NULL,
  image_fingerprint TEXT,
  engine_used TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`},{tableName:"receipt_line_items",description:"Extracted individual line items and unit price variance observations",rowCount:i.reduce((t,a)=>{var s;return t+(((s=a.line_items)==null?void 0:s.length)||0)},0),sql:`CREATE TABLE IF NOT EXISTS receipt_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1.0,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_line_items_desc ON receipt_line_items(description);`},{tableName:"quotes",description:"Contractor job estimates and quotes created on-site",rowCount:T.length,sql:`CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  quote_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  project_title TEXT NOT NULL,
  date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'sent', 'accepted', 'declined')),
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`},{tableName:"invoices",description:"Client invoices, milestone balances, and payment status",rowCount:d.length,sql:`CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'pending', 'paid', 'overdue')),
  total_amount REAL NOT NULL,
  amount_paid REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`},{tableName:"clients",description:"Directory of clients, general contractors, and site contacts",rowCount:E.length,sql:`CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  total_billed REAL DEFAULT 0.0,
  outstanding_balance REAL DEFAULT 0.0
);`},{tableName:"inventory",description:"Van stock, materials, cost vs billable prices, and reorder levels",rowCount:N.length,sql:`CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 2,
  unit_cost REAL NOT NULL,
  unit_price REAL NOT NULL,
  location TEXT
);`}],x=(t,a)=>{navigator.clipboard.writeText(t),r(a),setTimeout(()=>r(null),2e3)},p=()=>{const t=l.map(o=>`-- Table: ${o.tableName}
${o.sql}`).join(`

`),a=new Blob([t],{type:"text/sql"}),s=URL.createObjectURL(a),n=document.createElement("a");n.href=s,n.download=`parserpro_contractor_schema_${new Date().toISOString().substring(0,10)}.sql`,n.click(),URL.revokeObjectURL(s)};return e.jsxs("div",{className:"space-y-6 max-w-5xl mx-auto",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-4",children:[e.jsxs("div",{children:[e.jsxs("h1",{className:"text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5",children:[e.jsx(u,{className:"w-6 h-6 text-emerald-600"}),e.jsx("span",{children:"SQLite & Cloud Database Schema"})]}),e.jsx("p",{className:"text-sm text-slate-600 dark:text-slate-400 mt-0.5",children:"Production relational schema for local IndexedDB / SQLite offline storage & cloud replication."})]}),e.jsxs("button",{type:"button",onClick:p,className:"min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer self-start sm:self-auto",children:[e.jsx(b,{className:"w-4 h-4"}),e.jsx("span",{children:"Export Schema (.sql)"})]})]}),e.jsx("div",{className:"space-y-4",children:l.map(t=>{const a=m===t.tableName;return e.jsxs("div",{className:"rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs",children:[e.jsxs("div",{className:"p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-2.5",children:[e.jsx(g,{className:"w-4 h-4 text-emerald-600"}),e.jsx("span",{className:"font-mono text-sm font-bold text-slate-900 dark:text-white",children:t.tableName}),e.jsx("span",{className:"text-xs text-slate-400",children:"·"}),e.jsxs("span",{className:"text-xs text-slate-500 font-mono tabular-nums",children:[t.rowCount," live rows"]})]}),e.jsx("button",{type:"button",onClick:()=>x(t.sql,t.tableName),className:"px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5",children:a?e.jsxs(e.Fragment,{children:[e.jsx(A,{className:"w-3.5 h-3.5 text-emerald-600"}),e.jsx("span",{children:"Copied!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(R,{className:"w-3.5 h-3.5 text-slate-400"}),e.jsx("span",{children:"Copy DDL"})]})})]}),e.jsxs("div",{className:"p-4 space-y-2",children:[e.jsx("p",{className:"text-xs text-slate-500",children:t.description}),e.jsx("pre",{className:"p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto",children:e.jsx("code",{children:t.sql})})]})]},t.tableName)})})]})};export{C as SqlSchemaViewer,C as default};

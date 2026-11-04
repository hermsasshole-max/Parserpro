import React, { useState } from 'react';
import { Database, Table, Copy, Check, Download, Layers } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const SqlSchemaViewer: React.FC = () => {
  const { receipts, quotes, invoices, clients, inventory } = useAppContext();
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  const schemas = [
    {
      tableName: 'receipts',
      description: 'Itemized vendor receipts with totals, OCR metadata, and duplicate blocker hash',
      rowCount: receipts.length,
      sql: `CREATE TABLE IF NOT EXISTS receipts (
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
);`,
    },
    {
      tableName: 'receipt_line_items',
      description: 'Extracted individual line items and unit price variance observations',
      rowCount: receipts.reduce((s, r) => s + (r.line_items?.length || 0), 0),
      sql: `CREATE TABLE IF NOT EXISTS receipt_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1.0,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_line_items_desc ON receipt_line_items(description);`,
    },
    {
      tableName: 'quotes',
      description: 'Contractor job estimates and quotes created on-site',
      rowCount: quotes.length,
      sql: `CREATE TABLE IF NOT EXISTS quotes (
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
);`,
    },
    {
      tableName: 'invoices',
      description: 'Client invoices, milestone balances, and payment status',
      rowCount: invoices.length,
      sql: `CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'pending', 'paid', 'overdue')),
  total_amount REAL NOT NULL,
  amount_paid REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
    },
    {
      tableName: 'clients',
      description: 'Directory of clients, general contractors, and site contacts',
      rowCount: clients.length,
      sql: `CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  total_billed REAL DEFAULT 0.0,
  outstanding_balance REAL DEFAULT 0.0
);`,
    },
    {
      tableName: 'inventory',
      description: 'Van stock, materials, cost vs billable prices, and reorder levels',
      rowCount: inventory.length,
      sql: `CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 2,
  unit_cost REAL NOT NULL,
  unit_price REAL NOT NULL,
  location TEXT
);`,
    },
  ];

  const handleCopy = (sql: string, name: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedTable(name);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  const handleExportFullSchema = () => {
    const fullSql = schemas.map((s) => `-- Table: ${s.tableName}\n${s.sql}`).join('\n\n');
    const blob = new Blob([fullSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parserpro_contractor_schema_${new Date().toISOString().substring(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-emerald-600" />
            <span>SQLite &amp; Cloud Database Schema</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Production relational schema for local IndexedDB / SQLite offline storage &amp; cloud replication.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportFullSchema}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Schema (.sql)</span>
        </button>
      </div>

      {/* Schema Cards */}
      <div className="space-y-4">
        {schemas.map((table) => {
          const isCopied = copiedTable === table.tableName;
          return (
            <div
              key={table.tableName}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs"
            >
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Table className="w-4 h-4 text-emerald-600" />
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {table.tableName}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {table.rowCount} live rows
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(table.sql, table.tableName)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy DDL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 space-y-2">
                <p className="text-xs text-slate-500">{table.description}</p>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto">
                  <code>{table.sql}</code>
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SqlSchemaViewer;

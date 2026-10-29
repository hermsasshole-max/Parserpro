export type ReceiptCategory = 
  | 'Food & Groceries' 
  | 'Electricity & Utilities' 
  | 'Home Maintenance' 
  | 'Transport' 
  | 'Other';

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: ReceiptCategory;
}

export type OcrEngineType = 'cloud_api' | 'native_mlkit' | 'local_tesseract' | 'manual';

export type OcrEngineMode = 'auto_fallback' | 'cloud_only' | 'local_tesseract_only';

export interface ReceiptData {
  vendor_name: string;
  invoice_number?: string;
  invoice_date: string;
  month_year: string;
  category: ReceiptCategory;
  currency: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  total_amount: number;
  notes: string;
  engine_used?: OcrEngineType;
  image_fingerprint?: string;
}

export interface SavedReceipt extends ReceiptData {
  id: string;
  created_at: string;
  file_name?: string;
  image_preview?: string;
}

export interface CachedReceiptJob {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
  previewUrl?: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'fallback_extracted' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt: number; // timestamp in ms
  lastError?: string;
  engineUsed?: OcrEngineType;
  extractedReceipts?: ReceiptData[];
}

export interface QueueStatusStats {
  total: number;
  pending: number;
  processing: number;
  fallbackExtracted: number;
  completed: number;
  failed: number;
}

export interface ItemPriceObservation {
  receipt_id: string;
  invoice_date: string;
  vendor_name: string;
  invoice_number?: string;
  category: ReceiptCategory;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AggregatedItem {
  name: string;
  primary_category: ReceiptCategory;
  total_quantity: number;
  total_amount: number;
  average_unit_price: number;
  lowest_unit_price: number;
  highest_unit_price: number;
  latest_unit_price: number;
  latest_purchase_date: string;
  latest_vendor: string;
  price_variance: number;
  occurrences: number;
  categories: ReceiptCategory[];
  receipt_ids: string[];
  price_history: ItemPriceObservation[];
}

export interface ItemComparison {
  name: string;
  category: ReceiptCategory;
  // Month A (Target / Current)
  monthA_quantity: number;
  monthA_total: number;
  // Month B (Baseline / Comparison)
  monthB_quantity: number;
  monthB_total: number;
  // Delta
  amount_diff: number; // monthA_total - monthB_total
  qty_diff: number;
  percent_change: number; // ((monthA - monthB) / monthB) * 100
  status: 'spent_more' | 'saved_more' | 'new_item' | 'not_purchased' | 'unchanged';
}

export interface CategorySummaryRow {
  category: ReceiptCategory;
  subtotal: number;
  percentage: number;
  receipt_count: number;
  item_count: number;
}

export interface MonthReportData {
  month_year: string;
  total_spend: number;
  receipt_count: number;
  item_count: number;
  total_item_purchases: number;
  category_totals: Record<ReceiptCategory, number>;
  category_breakdown: CategorySummaryRow[];
  items_alphabetical: AggregatedItem[];
}

export type CategoryBudgets = Record<ReceiptCategory, number>;

export interface CategoryBudgetProgress {
  category: ReceiptCategory;
  spent: number;
  limit: number;
  percentUsed: number;
  barWidthPercent: number;
  remaining: number;
  overAmount: number;
  status: 'within' | 'near' | 'exceeded' | 'unset';
}


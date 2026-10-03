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
}

export type OcrEngineType = 'cloud_api' | 'local_tesseract' | 'manual';

export type OcrEngineMode = 'auto_fallback' | 'cloud_only' | 'local_tesseract_only';

export interface ReceiptData {
  vendor_name: string;
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

export interface AggregatedItem {
  name: string;
  total_quantity: number;
  total_amount: number;
  average_unit_price: number;
  occurrences: number;
  categories: ReceiptCategory[];
  receipt_ids: string[];
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

export interface MonthReportData {
  month_year: string;
  total_spend: number;
  receipt_count: number;
  item_count: number;
  category_totals: Record<ReceiptCategory, number>;
  items_alphabetical: AggregatedItem[];
}

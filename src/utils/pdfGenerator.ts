import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SavedReceipt } from '../types';
import { compareMonths, generateMonthReport } from './reportUtils';

export interface PDFExportOptions {
  monthA: string;
  monthB: string;
  receipts: SavedReceipt[];
}

/**
 * Helper to download a Blob safely across desktop and mobile devices/WebViews
 */
export function saveBlobToFile(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    console.error('Blob download failed, falling back to data URL:', err);
    throw err;
  }
}

/**
 * Builds a high-resolution, multi-page vector PDF report comparing Month A vs Month B.
 * Optimized for A4 dimensions with zero column overflow and accurate multi-page stamping.
 */
export function buildComparisonPDFDoc(monthA: string, monthB: string, receipts: SavedReceipt[]): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const comparison = compareMonths(monthA, monthB, receipts);
  const isNetSaving = comparison.totalDiff < 0;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary Colors (RGB)
  const primaryNavy = [15, 23, 42]; // #0f172a
  const emeraldGreen = [5, 150, 105]; // #059669
  const roseRed = [225, 29, 72]; // #e11d48
  const slateMuted = [100, 116, 139]; // #64748b
  const slateLight = [248, 250, 252]; // #f8fafc

  let y = 14;

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(14, y, pageWidth - 28, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('HOUSEHOLD EXPENDITURE & GROCERY REPORT', 18, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Comparative Analysis: ${monthA} vs ${monthB}  •  Currency: ZAR (R)`, 18, y + 16);

  // Date on the right of banner
  const genDate = new Date().toLocaleDateString('en-ZA');
  doc.setFontSize(8);
  doc.text(`Generated: ${genDate}`, pageWidth - 18, y + 8, { align: 'right' });
  doc.text('Confidential Personal Ledger', pageWidth - 18, y + 16, { align: 'right' });

  y += 28;

  // Executive Summary 3-Box Grid
  const boxWidth = (pageWidth - 28 - 8) / 3;
  const boxHeight = 20;

  // Box 1: Month A Spend
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(`${monthA} TOTAL SPEND`, 18, y + 6);
  doc.setFontSize(12);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`R ${comparison.totalA.toFixed(2)}`, 18, y + 14);

  // Box 2: Month B Spend
  const box2X = 14 + boxWidth + 4;
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(box2X, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(`${monthB} TOTAL SPEND`, box2X + 4, y + 6);
  doc.setFontSize(12);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`R ${comparison.totalB.toFixed(2)}`, box2X + 4, y + 14);

  // Box 3: Variance
  const box3X = box2X + boxWidth + 4;
  if (isNetSaving) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
  } else {
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
  }
  doc.roundedRect(box3X, y, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(
    isNetSaving ? emeraldGreen[0] : roseRed[0],
    isNetSaving ? emeraldGreen[1] : roseRed[1],
    isNetSaving ? emeraldGreen[2] : roseRed[2]
  );
  doc.text(`NET VARIANCE (${isNetSaving ? 'SAVED' : 'INCREASED'})`, box3X + 4, y + 6);
  doc.setFontSize(12);
  const diffSign = isNetSaving ? '- R ' : '+ R ';
  doc.text(`${diffSign}${Math.abs(comparison.totalDiff).toFixed(2)}`, box3X + 4, y + 14);

  doc.setFontSize(7);
  doc.text(`${isNetSaving ? 'Saved ' : 'Up '}${Math.abs(comparison.totalPercentChange)}% vs ${monthB}`, box3X + 4, y + 18);

  y += boxHeight + 8;

  // Category Breakdown Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('CATEGORY EXPENDITURE BREAKDOWN', 14, y);
  y += 3;

  const categoryRows = comparison.categoryComparison.map(cat => [
    cat.category,
    `R ${cat.monthA.toFixed(2)}`,
    `R ${cat.monthB.toFixed(2)}`,
    cat.diff < 0
      ? `- R ${Math.abs(cat.diff).toFixed(2)} (Saved)`
      : cat.diff > 0
      ? `+ R ${cat.diff.toFixed(2)}`
      : 'R 0.00',
  ]);

  // Width available between 14mm margins = 210 - 28 = 182mm
  // Column distribution: 70 + 36 + 36 + 40 = 182mm
  autoTable(doc, {
    startY: y,
    head: [['Category', `${monthA} Spend`, `${monthB} Spend`, 'Variance (ZAR)']],
    body: categoryRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      font: 'helvetica',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 36, halign: 'right' },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const lastTable = (doc as any).lastAutoTable;
  y = (lastTable ? lastTable.finalY : y) + 8;

  // Alphabetical Item Table Heading
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`ITEM-BY-ITEM CALCULATED LEDGER (A-Z)  •  ${comparison.items.length} Unique Items`, 14, y);
  y += 3;

  const itemRows = comparison.items.map(item => {
    const statusText =
      item.status === 'saved_more' ? 'Saved' :
      item.status === 'not_purchased' ? 'Not Bought' :
      item.status === 'spent_more' ? 'Spent More' :
      item.status === 'new_item' ? 'New Item' : 'Equal';

    const diffText = item.amount_diff < 0
      ? `- R ${Math.abs(item.amount_diff).toFixed(2)}`
      : item.amount_diff > 0
      ? `+ R ${item.amount_diff.toFixed(2)}`
      : 'R 0.00';

    return [
      item.name,
      item.category,
      `${item.monthA_quantity}`,
      `R ${item.monthA_total.toFixed(2)}`,
      `${item.monthB_quantity}`,
      `R ${item.monthB_total.toFixed(2)}`,
      diffText,
      statusText
    ];
  });

  // Table Width calculation: Total exactly 182mm (page width 210mm - 28mm margin)
  // 0: 50mm, 1: 28mm, 2: 12mm, 3: 22mm, 4: 12mm, 5: 22mm, 6: 22mm, 7: 14mm = 182mm
  autoTable(doc, {
    startY: y,
    showHead: 'everyPage',
    head: [[
      'Item Description (A-Z)',
      'Category',
      `${monthA} Qty`,
      `${monthA} Total`,
      `${monthB} Qty`,
      `${monthB} Total`,
      'Variance',
      'Status'
    ]],
    body: itemRows.length > 0 ? itemRows : [['No line items recorded', '-', '0', 'R 0.00', '0', 'R 0.00', 'R 0.00', '-']],
    foot: [[
      'GRAND TOTALS',
      '',
      '',
      `R ${comparison.totalA.toFixed(2)}`,
      '',
      `R ${comparison.totalB.toFixed(2)}`,
      `${isNetSaving ? '- R ' : '+ R '}${Math.abs(comparison.totalDiff).toFixed(2)}`,
      isNetSaving ? 'Saved' : 'Increased'
    ]],
    theme: 'striped',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      font: 'helvetica',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 14, halign: 'center' },
    },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  // Accurate multi-page footer stamp (Page X of Y)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      `ParserPro Personal Accounting  •  Page ${i} of ${totalPages}`,
      14,
      pageHeight - 8
    );
    doc.text(
      `Comparative Report (${monthA} vs ${monthB})  •  Currency: ZAR (R)`,
      pageWidth - 14,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Builds a clean, professional vector PDF statement for a single month.
 * Includes executive KPIs, category summary, alphabetical item breakdown, and invoice register.
 */
export function buildSingleMonthPDFDoc(month: string, receipts: SavedReceipt[]): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const report = generateMonthReport(month, receipts);
  const monthReceipts = receipts.filter(r => r.month_year === month);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryNavy = [15, 23, 42];
  const emeraldGreen = [5, 150, 105];
  const slateMuted = [100, 116, 139];
  const slateLight = [248, 250, 252];

  let y = 14;

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(14, y, pageWidth - 28, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`MONTHLY EXPENDITURE STATEMENT: ${month}`, 18, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Personal Ledger & Grocery Audit  •  Currency: ZAR (R)`, 18, y + 16);

  const genDate = new Date().toLocaleDateString('en-ZA');
  doc.setFontSize(8);
  doc.text(`Generated: ${genDate}`, pageWidth - 18, y + 8, { align: 'right' });
  doc.text('Confidential Document', pageWidth - 18, y + 16, { align: 'right' });

  y += 28;

  // 4 KPI Cards (Total Spend, Invoices, Items, Top Category)
  const cardWidth = (pageWidth - 28 - 9) / 4;
  const cardHeight = 18;

  // Card 1: Total Spend
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text('TOTAL EXPENDITURE', 17, y + 5.5);
  doc.setFontSize(11);
  doc.text(`R ${report.total_spend.toFixed(2)}`, 17, y + 13);

  // Card 2: Invoices Filed
  const card2X = 14 + cardWidth + 3;
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text('INVOICES FILED', card2X + 3, y + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`${report.receipt_count}`, card2X + 3, y + 13);

  // Card 3: Line Items
  const card3X = card2X + cardWidth + 3;
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card3X, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text('DISTINCT ITEMS (A-Z)', card3X + 3, y + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`${report.items_alphabetical.length}`, card3X + 3, y + 13);

  // Card 4: Top Category
  const card4X = card3X + cardWidth + 3;
  const categoriesSorted = Object.entries(report.category_totals).sort((a, b) => b[1] - a[1]);
  const topCategoryName = categoriesSorted[0] ? categoriesSorted[0][0] : 'None';
  doc.setFillColor(slateLight[0], slateLight[1], slateLight[2]);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(card4X, y, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text('TOP CATEGORY', card4X + 3, y + 5.5);
  doc.setFontSize(9);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(topCategoryName.substring(0, 16), card4X + 3, y + 13);

  y += cardHeight + 8;

  // Category Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('CATEGORY EXPENDITURE BREAKDOWN', 14, y);
  y += 3;

  const categoryRows = categoriesSorted.map(([cat, amt]) => {
    const pct = report.total_spend > 0 ? ((amt / report.total_spend) * 100).toFixed(1) : '0.0';
    return [cat, `R ${amt.toFixed(2)}`, `${pct} %`];
  });

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Total Spend (ZAR)', '% of Monthly Budget']],
    body: categoryRows.length > 0 ? categoryRows : [['No categories', 'R 0.00', '0%']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 92, fontStyle: 'bold' },
      1: { cellWidth: 50, halign: 'right' },
      2: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  let lastTable = (doc as any).lastAutoTable;
  y = (lastTable ? lastTable.finalY : y) + 8;

  // Merged Item-by-Item Breakdown
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`MERGED ITEM-BY-ITEM LEDGER (A-Z)  •  ${report.items_alphabetical.length} Items`, 14, y);
  y += 3;

  const itemRows = report.items_alphabetical.map(item => [
    item.name,
    item.categories.join(', ') || 'Uncategorized',
    `${item.total_quantity}`,
    `R ${item.average_unit_price.toFixed(2)}`,
    `R ${item.total_amount.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: y,
    showHead: 'everyPage',
    head: [['Item Description (A-Z)', 'Category', 'Quantity', 'Avg Unit Price', 'Total Cost (ZAR)']],
    body: itemRows.length > 0 ? itemRows : [['No items recorded for this month', '-', '0', 'R 0.00', 'R 0.00']],
    foot: [['TOTAL ITEMIZED EXPENDITURE', '', '', '', `R ${report.total_spend.toFixed(2)}`]],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 1.8, font: 'helvetica' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 66, fontStyle: 'bold' },
      1: { cellWidth: 42 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  lastTable = (doc as any).lastAutoTable;
  y = (lastTable ? lastTable.finalY : y) + 8;

  // Invoices Register
  if (y > pageHeight - 35) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`INVOICE & RECEIPT REGISTER  •  ${monthReceipts.length} Documents`, 14, y);
  y += 3;

  const invoiceRows = monthReceipts.map(r => [
    r.invoice_date,
    r.vendor_name,
    r.category,
    `${r.line_items.length} items`,
    `R ${Number(r.total_amount).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: y,
    showHead: 'everyPage',
    head: [['Date', 'Vendor / Store', 'Category', 'Items Count', 'Total Paid (ZAR)']],
    body: invoiceRows.length > 0 ? invoiceRows : [['No invoices recorded', '-', '-', '0', 'R 0.00']],
    foot: [['MONTHLY REGISTER TOTAL', '', '', '', `R ${report.total_spend.toFixed(2)}`]],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 54, fontStyle: 'bold' },
      2: { cellWidth: 42 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  // Multi-page page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      `ParserPro Personal Accounting  •  Page ${i} of ${totalPages}`,
      14,
      pageHeight - 8
    );
    doc.text(
      `Monthly Statement (${month})  •  Currency: ZAR (R)`,
      pageWidth - 14,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Downloads the comparison PDF directly onto the device storage.
 */
export async function downloadComparisonPDF(monthA: string, monthB: string, receipts: SavedReceipt[]): Promise<{ success: boolean; filename: string }> {
  try {
    const doc = buildComparisonPDFDoc(monthA, monthB, receipts);
    const fileName = `Expenditure_Report_${monthA}_vs_${monthB}.pdf`;
    const blob = doc.output('blob');
    saveBlobToFile(blob, fileName);
    return { success: true, filename: fileName };
  } catch (error) {
    console.error('Error generating and downloading PDF:', error);
    return { success: false, filename: '' };
  }
}

/**
 * Downloads single month statement PDF.
 */
export async function downloadSingleMonthPDF(month: string, receipts: SavedReceipt[]): Promise<{ success: boolean; filename: string }> {
  try {
    const doc = buildSingleMonthPDFDoc(month, receipts);
    const fileName = `Monthly_Statement_${month}.pdf`;
    const blob = doc.output('blob');
    saveBlobToFile(blob, fileName);
    return { success: true, filename: fileName };
  } catch (error) {
    console.error('Error generating single month PDF:', error);
    return { success: false, filename: '' };
  }
}

/**
 * Shares or saves PDF via Web Share API or falls back to direct device download.
 * Handles mobile WhatsApp, Drive, Gmail, and nearby sharing seamlessly.
 */
export async function shareOrSavePDF(
  monthA: string,
  monthB: string,
  receipts: SavedReceipt[]
): Promise<{ success: boolean; message: string; sharedVia: 'native_share' | 'download' }> {
  try {
    const doc = buildComparisonPDFDoc(monthA, monthB, receipts);
    const fileName = `Expenditure_Report_${monthA}_vs_${monthB}.pdf`;
    const pdfBlob = doc.output('blob');

    // Attempt Native Share Sheet (WhatsApp, Google Drive, Gmail, Files)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Household Expenditure Report: ${monthA} vs ${monthB}`,
            text: `Comparative household expenditure report for ${monthA} vs ${monthB}.`,
            files: [file]
          });
          return { success: true, message: 'Shared report via system share sheet!', sharedVia: 'native_share' };
        }
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return { success: true, message: 'Share closed.', sharedVia: 'native_share' };
        }
        console.warn('Native file share failed or was cancelled, attempting download fallback:', shareErr);
      }
    }

    // Direct download fallback
    saveBlobToFile(pdfBlob, fileName);
    return {
      success: true,
      message: 'PDF saved to your device Downloads folder!',
      sharedVia: 'download'
    };
  } catch (error) {
    console.error('PDF share/save failed:', error);
    return { success: false, message: 'Failed to generate and share PDF.', sharedVia: 'download' };
  }
}

/**
 * Shares or saves a single month PDF statement.
 */
export async function shareOrSaveSingleMonthPDF(
  month: string,
  receipts: SavedReceipt[]
): Promise<{ success: boolean; message: string; sharedVia: 'native_share' | 'download' }> {
  try {
    const doc = buildSingleMonthPDFDoc(month, receipts);
    const fileName = `Monthly_Statement_${month}.pdf`;
    const pdfBlob = doc.output('blob');

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Monthly Expenditure Statement: ${month}`,
            text: `Household monthly expenditure statement for ${month}.`,
            files: [file]
          });
          return { success: true, message: 'Shared statement via system share sheet!', sharedVia: 'native_share' };
        }
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return { success: true, message: 'Share closed.', sharedVia: 'native_share' };
        }
        console.warn('Share error:', shareErr);
      }
    }

    saveBlobToFile(pdfBlob, fileName);
    return {
      success: true,
      message: `Statement saved to your device Downloads folder!`,
      sharedVia: 'download'
    };
  } catch (error) {
    console.error('Single month share failed:', error);
    return { success: false, message: 'Failed to share statement.', sharedVia: 'download' };
  }
}

/**
 * Robust print handler.
 * If printable-report-area is in the DOM, triggers clean window.print().
 * If print fails or is blocked by sandbox permissions, falls back to instant vector PDF download.
 */
export async function printReportSafely(
  monthA: string,
  monthB: string,
  receipts: SavedReceipt[]
): Promise<{ success: boolean; method: 'print' | 'pdf'; message: string }> {
  const printArea = document.getElementById('printable-report-area');

  if (printArea && typeof window !== 'undefined') {
    try {
      window.focus();
      window.print();
      return { success: true, method: 'print', message: 'Print dialog opened.' };
    } catch (err) {
      console.warn('Browser print dialog encountered an issue, generating PDF fallback:', err);
    }
  }

  // Fallback: generate and download vector PDF
  try {
    const res = await downloadComparisonPDF(monthA, monthB, receipts);
    if (res.success) {
      return {
        success: true,
        method: 'pdf',
        message: 'Downloaded print-ready vector PDF to your device.'
      };
    }
    return { success: false, method: 'pdf', message: 'Failed to generate PDF.' };
  } catch (e) {
    console.error('Print fallback error:', e);
    return { success: false, method: 'pdf', message: 'Print could not be initiated.' };
  }
}

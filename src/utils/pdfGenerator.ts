import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SavedReceipt } from '../types';
import { compareMonths } from './reportUtils';

export interface PDFExportOptions {
  monthA: string;
  monthB: string;
  receipts: SavedReceipt[];
}

/**
 * Builds a high-resolution, multi-page vector PDF report comparing Month A vs Month B
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

  // Primary Colors
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
  doc.setFontSize(13);
  doc.text('HOUSEHOLD EXPENDITURE & GROCERY REPORT', 18, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
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
  doc.setTextColor(isNetSaving ? emeraldGreen[0] : roseRed[0], isNetSaving ? emeraldGreen[1] : roseRed[1], isNetSaving ? emeraldGreen[2] : roseRed[2]);
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
      1: { cellWidth: 35, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 42, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const lastTable = (doc as any).lastAutoTable;
  y = (lastTable ? lastTable.finalY : y) + 8;

  // Alphabetical Item Table
  if (y > pageHeight - 40) {
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
      item.status === 'saved_more' ? 'Saved More' :
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

  autoTable(doc, {
    startY: y,
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
    body: itemRows,
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
      1: { cellWidth: 30 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 16, halign: 'center' },
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: (data) => {
      // Add page footer to every page
      const current = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ParserPro Personal Accounting  •  Page ${data.pageNumber} of ${current}`,
        14,
        pageHeight - 8
      );
      doc.text(
        'Generated on Android Device Storage',
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  });

  return doc;
}

/**
 * Downloads the comparison PDF directly onto the device storage
 */
export async function downloadComparisonPDF(monthA: string, monthB: string, receipts: SavedReceipt[]): Promise<boolean> {
  try {
    const doc = buildComparisonPDFDoc(monthA, monthB, receipts);
    const fileName = `Expenditure_Report_${monthA}_vs_${monthB}.pdf`;
    
    // Save directly using jsPDF's built-in file saver (creates Blob and triggers download)
    doc.save(fileName);
    return true;
  } catch (error) {
    console.error('Error generating and downloading PDF:', error);
    return false;
  }
}

/**
 * Shares or saves PDF via Android Web Share API (native share sheet: Save to Files / Drive / Print)
 */
export async function shareOrSavePDF(monthA: string, monthB: string, receipts: SavedReceipt[]): Promise<boolean> {
  try {
    const doc = buildComparisonPDFDoc(monthA, monthB, receipts);
    const fileName = `Expenditure_Report_${monthA}_vs_${monthB}.pdf`;
    const pdfBlob = doc.output('blob');

    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Check if navigator.share supports files
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `Expenditure Report: ${monthA} vs ${monthB}`,
        text: `Comparative household expenditure report for ${monthA} and ${monthB}.`,
        files: [file]
      });
      return true;
    } else {
      // Fallback: direct download
      doc.save(fileName);
      return true;
    }
  } catch (error) {
    // If user cancelled the share sheet, that's not an error
    if ((error as any)?.name === 'AbortError') {
      return true;
    }
    console.warn('Share failed, attempting direct download:', error);
    try {
      const doc = buildComparisonPDFDoc(monthA, monthB, receipts);
      doc.save(`Expenditure_Report_${monthA}_vs_${monthB}.pdf`);
      return true;
    } catch (e) {
      console.error('Direct download fallback failed:', e);
      return false;
    }
  }
}

/**
 * Robust print handler that isolates the printable document and triggers print
 * or falls back to direct PDF download on mobile/Android devices where print is unhandled.
 */
export function printReportSafely(monthA: string, monthB: string, receipts: SavedReceipt[]): void {
  // If user is on an Android device or inside an iframe where window.print is known to fail/hang,
  // we offer a direct PDF download as the most reliable path.
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  
  if (isAndroid) {
    downloadComparisonPDF(monthA, monthB, receipts);
    return;
  }

  // Attempt window.print() inside a dedicated clean iframe to prevent printing app layout/modals
  try {
    const printArea = document.getElementById('printable-report-area');
    if (!printArea) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Expenditure Report ${monthA} vs ${monthB}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              background: #ffffff;
              padding: 0;
              margin: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
              text-align: left;
            }
            th {
              background: #f1f5f9;
              font-weight: bold;
            }
            .no-print { display: none !important; }
            .grid { display: flex; gap: 12px; margin: 12px 0; }
            .card { flex: 1; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print():', err);
        window.print();
        document.body.removeChild(iframe);
      }
    }, 300);
  } catch (e) {
    console.warn('Print error, falling back to PDF download:', e);
    downloadComparisonPDF(monthA, monthB, receipts);
  }
}

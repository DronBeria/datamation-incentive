import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (!data.length) return;

  const cols = columns || Object.keys(data[0]).map((k) => ({ key: k, label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));
  const header = cols.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((row) =>
    cols.map((c) => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (!data.length) return;

  const cols = columns || Object.keys(data[0]).map((k) => ({ key: k, label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));

  const excelData = data.map(row => {
    const newRow: Record<string, any> = {};
    cols.forEach(col => {
      newRow[col.label] = row[col.key];
    });
    return newRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });

  const fullFilename = `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF(title: string, columns: { key: string; label: string }[], data: Record<string, any>[], filename: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 22);

  const head = [columns.map(c => c.label)];
  const body = data.map(row => columns.map(c => row[c.key] ?? "-"));

  autoTable(doc, {
    head: head,
    body: body,
    startY: 30,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      halign: 'left',
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      amount: { halign: 'right', fontStyle: 'bold' },
      total_amount: { halign: 'right', fontStyle: 'bold' }
    }
  });

  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
}

/** Legacy HTML-based print/PDF function */
export function downloadPDF(title: string, tables: { heading: string; columns: { key: string; label: string }[]; data: Record<string, any>[] }[]) {
  // Generate printable HTML and open in new window for native PDF printing
  const styles = `
    <style>
      @page { margin: 15mm; size: A4 landscape; }
      body { font-family: 'Courier New', Courier, monospace; color: #000; margin: 0; padding: 0; font-size: 10px; }
      .container { padding: 20px; border: 1px solid #000; }
      h1 { font-size: 16px; margin: 0 0 10px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; }
      .meta { font-size: 9px; margin-bottom: 20px; font-weight: bold; }
      h2 { font-size: 12px; margin: 15px 0 5px; text-transform: uppercase; background: #eee; padding: 4px 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      th { border: 1px solid #000; padding: 6px; text-align: left; background: #fff; text-transform: uppercase; }
      td { border: 1px solid #000; padding: 6px; }
      .text-right { text-align: right; }
      .footer { margin-top: 20px; font-size: 8px; text-align: center; border-top: 1px solid #ccc; padding-top: 5px; }
    </style>
  `;

  let html = `<!DOCTYPE html><html><head><title>${title}</title>${styles}</head><body>`;
  html += `<h1>${title}</h1>`;
  html += `<div class="meta">Generated on ${new Date().toLocaleString()} | IncentivePro Incentive Management System</div>`;

  for (const tbl of tables) {
    if (!tbl.data.length) continue;
    html += `<h2>${tbl.heading}</h2>`;
    html += `<table><thead><tr>${tbl.columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>`;
    for (const row of tbl.data) {
      html += `<tr>${tbl.columns.map((c) => {
        const isNum = ['amount', 'deal_value', 'total_amount'].includes(c.key);
        return `<td class="${isNum ? 'text-right' : ''}">${row[c.key] ?? "-"}</td>`;
      }).join("")}</tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<div class="footer">Confidential - For authorized use only</div>`;
  html += `</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

// ─── TALLY XML EXPORT (8.3) ──────────────────────────────────────────────────
/**
 * Export a paid batch as Tally-compatible XML vouchers.
 * Each salesperson gets a separate Payment voucher entry.
 *
 * @param batchName  Batch name shown in Tally narration
 * @param batchRef   Reference number
 * @param paidDate   Date of payment (YYYY-MM-DD)
 * @param items      Batch items with salesperson_name and amount
 */
export function exportToTallyXML(
  batchName: string,
  batchRef: string,
  paidDate: string,
  items: { salesperson_name: string; amount: number }[]
) {
  const dateFormatted = paidDate.replace(/-/g, ""); // YYYYMMDD for Tally

  const vouchers = items.map((item, idx) => `
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
      <VOUCHER REMOTEID="${batchRef}-${idx + 1}" VCHTYPE="Payment" ACTION="Create">
        <DATE>${dateFormatted}</DATE>
        <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${batchRef}-${idx + 1}</VOUCHERNUMBER>
        <NARRATION>Commission payment to ${item.salesperson_name} | ${batchName} | Ref: ${batchRef}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Commission Expense</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${item.amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Cash / Bank</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>
    </TALLYMESSAGE>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>##SVCURRENTCOMPANY</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tally_${batchRef}_${paidDate}.xml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── QUICKBOOKS IIF EXPORT (8.3) ─────────────────────────────────────────────
/**
 * Export a paid batch as QuickBooks IIF (Interchange File Format).
 * Creates a GENERAL JOURNAL entry debiting Commission Expense and
 * crediting the Bank/Cash account for each payee.
 */
export function exportToQuickBooksIIF(
  batchName: string,
  batchRef: string,
  paidDate: string,
  items: { salesperson_name: string; amount: number }[]
) {
  // IIF date format: MM/DD/YY
  const [y, m, d] = paidDate.split("-");
  const iifDate = `${m}/${d}/${y.slice(2)}`;

  const lines: string[] = [
    "!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\tCLEAR",
    "!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO",
    "!ENDTRNS",
  ];

  items.forEach((item, idx) => {
    const memo = `${batchName} | Ref: ${batchRef}`;
    lines.push(`TRNS\tGENJRNL\t${iifDate}\tCommission Expense\t${item.salesperson_name}\t${(-item.amount).toFixed(2)}\t${memo}\tN`);
    lines.push(`SPL\tGENJRNL\t${iifDate}\tBank Account\t${item.salesperson_name}\t${item.amount.toFixed(2)}\t${memo}`);
    lines.push("ENDTRNS");
    if (idx < items.length - 1) lines.push("");
  });

  const iif = lines.join("\r\n");
  const blob = new Blob([iif], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `qb_${batchRef}_${paidDate}.iif`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

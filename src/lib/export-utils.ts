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

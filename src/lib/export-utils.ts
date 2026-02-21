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

export function downloadPDF(title: string, tables: { heading: string; columns: { key: string; label: string }[]; data: Record<string, any>[] }[]) {
  // Generate printable HTML and open in new window for native PDF printing
  const styles = `
    <style>
      @page { margin: 20mm; size: A4 landscape; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; margin: 0; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
      .meta { font-size: 11px; color: #64748b; margin-bottom: 24px; }
      h2 { font-size: 14px; color: #334155; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
      th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid #e2e8f0; }
      td { padding: 5px 10px; border: 1px solid #e2e8f0; }
      tr:nth-child(even) { background: #f8fafc; }
      .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    </style>
  `;

  let html = `<!DOCTYPE html><html><head><title>${title}</title>${styles}</head><body>`;
  html += `<h1>${title}</h1>`;
  html += `<div class="meta">Generated on ${new Date().toLocaleString()} | PayoutPower Incentive Management System</div>`;

  for (const tbl of tables) {
    if (!tbl.data.length) continue;
    html += `<h2>${tbl.heading}</h2>`;
    html += `<table><thead><tr>${tbl.columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>`;
    for (const row of tbl.data) {
      html += `<tr>${tbl.columns.map((c) => `<td>${row[c.key] ?? "-"}</td>`).join("")}</tr>`;
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

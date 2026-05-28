import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const renderMarkOnCtx = (ctx, mark) => {
  const r = 16;
  ctx.beginPath();
  ctx.arc(mark.position_x, mark.position_y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#F59E0B';
  ctx.fill();
  ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px JetBrains Mono';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const num = mark.ref_id.replace('REF-', '');
  ctx.fillText(num, mark.position_x, mark.position_y);
};

const loadDrawingPages = async (drawing) => {
  const resp = await fetch(`${API}/drawings/${drawing.id}/download`, { credentials: 'include' });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const pages = [];
  try {
    if (drawing.filename.toLowerCase().endsWith('.pdf')) {
      const pdf = await pdfjsLib.getDocument(url).promise;
      for (let pn = 1; pn <= pdf.numPages; pn += 1) {
        const page = await pdf.getPage(pn);
        const viewport = page.getViewport({ scale: 1.5 });
        const off = document.createElement('canvas');
        off.width = viewport.width; off.height = viewport.height;
        await page.render({ canvasContext: off.getContext('2d'), viewport }).promise;
        pages.push(off);
      }
    } else {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const off = document.createElement('canvas');
      off.width = img.width; off.height = img.height;
      off.getContext('2d').drawImage(img, 0, 0);
      pages.push(off);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return pages;
};

export const generateFullReport = async ({ projectName, drawings, marks, boqRows }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;

  // Cover page
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(projectName || 'QTO Project', margin, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text('Reference Marks Report', margin, 110);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 132);
  doc.text(`Drawings: ${drawings.length}    Marks: ${marks.length}`, margin, 150);
  doc.setTextColor(0);

  // For each drawing, render each page with marks burned in
  for (const drawing of drawings) {
    let pages = [];
    try { pages = await loadDrawingPages(drawing); }
    catch (e) { continue; }

    for (let pn = 1; pn <= pages.length; pn += 1) {
      const src = pages[pn - 1];
      const pageMarks = marks.filter((m) => m.drawing_id === drawing.id && (m.page || 1) === pn);

      // Composite: copy page + draw marks
      const out = document.createElement('canvas');
      out.width = src.width; out.height = src.height;
      const ctx = out.getContext('2d');
      ctx.drawImage(src, 0, 0);
      pageMarks.forEach((m) => renderMarkOnCtx(ctx, m));

      const dataUrl = out.toDataURL('image/jpeg', 0.85);

      // Fit image into landscape page with header
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${drawing.filename}  ·  Page ${pn} of ${pages.length}`, margin, 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Marks on this page: ${pageMarks.length}`, pageWidth - margin, 24, { align: 'right' });
      doc.setTextColor(0);

      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin - 40;
      const imgRatio = out.width / out.height;
      let drawW = availW;
      let drawH = availW / imgRatio;
      if (drawH > availH) { drawH = availH; drawW = availH * imgRatio; }
      const x = (pageWidth - drawW) / 2;
      const y = 40;
      doc.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
    }
  }

  // Reference Index page(s) using autoTable
  const tableBody = marks.map((m) => {
    const dr = drawings.find((d) => d.id === m.drawing_id);
    const row = boqRows.find((r) => r.id === m.boq_row_id);
    return [
      m.ref_id,
      dr ? `${dr.filename} pg.${m.page || 1}` : '—',
      row?.item_no || '—',
      row?.description || '—',
      m.label || '—',
    ];
  });

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Drawing Reference Index', margin, 36);
  autoTable(doc, {
    startY: 56,
    head: [['Ref ID', 'Drawing + Page', 'BOQ Item', 'Description', 'Label / Note']],
    body: tableBody,
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11] },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 180 },
      2: { cellWidth: 70 },
    },
    margin: { left: margin, right: margin },
  });

  // The first jsPDF page is the cover (auto-created). All other pages were added via addPage.
  const safeName = ((projectName || 'QTO').trim().replace(/[^A-Za-z0-9_\-]+/g, '_')).replace(/_+$/, '');
  doc.save(`${safeName}_FullReport.pdf`);
};

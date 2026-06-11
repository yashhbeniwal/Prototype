import PDFDocument from 'pdfkit';

/**
 * Generate a professional invoice PDF
 */
export async function generateInvoicePDF(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const colors = { primary: '#1a1a2e', accent: '#e94560', gray: '#6b7280', light: '#f9fafb' };

    // ─── Header ─────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 100).fill(colors.primary);

    doc.fillColor('white').fontSize(24).font('Helvetica-Bold')
      .text(invoice.farm?.name || 'Goat Farm', 50, 30);
    doc.fontSize(10).font('Helvetica')
      .text(invoice.farm?.address || '', 50, 60)
      .text(`GST: ${invoice.farm?.gstNumber || 'N/A'}  |  UPI: ${invoice.farm?.upiId || 'N/A'}`, 50, 75);

    doc.fillColor(colors.accent).fontSize(20).font('Helvetica-Bold')
      .text('INVOICE', 400, 35, { align: 'right' });
    doc.fillColor('white').fontSize(10).font('Helvetica')
      .text(`# ${invoice.invoiceNumber}`, 400, 65, { align: 'right' });

    // ─── Bill To Section ─────────────────────────────────────────────────────
    doc.moveDown(3);
    const yPos = 130;

    doc.fillColor(colors.primary).fontSize(10).font('Helvetica-Bold').text('BILL TO:', 50, yPos);
    doc.fillColor(colors.gray).fontSize(10).font('Helvetica')
      .text(invoice.customer?.name || '', 50, yPos + 15)
      .text(invoice.customer?.address || '', 50, yPos + 28)
      .text(`Mobile: ${invoice.customer?.mobile || ''}`, 50, yPos + 41)
      .text(`GST: ${invoice.customer?.gstNumber || 'N/A'}`, 50, yPos + 54);

    doc.fillColor(colors.gray).fontSize(10)
      .text(`Invoice Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, 380, yPos, { align: 'right', width: 180 })
      .text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, 380, yPos + 15, { align: 'right', width: 180 })
      .text(`Status: ${invoice.status}`, 380, yPos + 30, { align: 'right', width: 180 });

    // ─── Items Table ─────────────────────────────────────────────────────────
    const tableTop = 230;
    const tableHeaders = ['Description', 'Qty', 'Unit Price', 'GST%', 'Total'];
    const colWidths = [220, 50, 90, 60, 90];
    const colStarts = [50, 270, 320, 410, 470];

    // Table header
    doc.rect(50, tableTop, 510, 20).fill(colors.primary);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((h, i) => {
      doc.text(h, colStarts[i], tableTop + 6, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
    });

    // Table rows
    let rowY = tableTop + 25;
    doc.fillColor(colors.primary).font('Helvetica').fontSize(9);

    (invoice.items || []).forEach((item: any, idx: number) => {
      if (idx % 2 === 0) {
        doc.rect(50, rowY - 4, 510, 20).fill('#f8f9fa');
      }
      doc.fillColor(colors.primary);
      doc.text(item.description, colStarts[0], rowY, { width: colWidths[0] });
      doc.text(String(item.quantity), colStarts[1], rowY, { width: colWidths[1], align: 'right' });
      doc.text(`₹${item.unitPrice.toFixed(2)}`, colStarts[2], rowY, { width: colWidths[2], align: 'right' });
      doc.text(`${item.gstRate}%`, colStarts[3], rowY, { width: colWidths[3], align: 'right' });
      doc.text(`₹${item.totalPrice.toFixed(2)}`, colStarts[4], rowY, { width: colWidths[4], align: 'right' });
      rowY += 22;
    });

    // ─── Totals ──────────────────────────────────────────────────────────────
    doc.moveTo(50, rowY).lineTo(560, rowY).strokeColor(colors.gray).stroke();
    rowY += 15;

    const totals = [
      { label: 'Sub Total', value: `₹${invoice.subTotal.toFixed(2)}` },
      ...(invoice.discountAmount > 0 ? [{ label: 'Discount', value: `-₹${invoice.discountAmount.toFixed(2)}` }] : []),
      ...(invoice.cgstAmount > 0 ? [{ label: 'CGST', value: `₹${invoice.cgstAmount.toFixed(2)}` }] : []),
      ...(invoice.sgstAmount > 0 ? [{ label: 'SGST', value: `₹${invoice.sgstAmount.toFixed(2)}` }] : []),
      ...(invoice.igstAmount > 0 ? [{ label: 'IGST', value: `₹${invoice.igstAmount.toFixed(2)}` }] : []),
    ];

    totals.forEach(({ label, value }) => {
      doc.fillColor(colors.gray).font('Helvetica').fontSize(9)
        .text(label, 380, rowY).text(value, 470, rowY, { width: 90, align: 'right' });
      rowY += 18;
    });

    // Grand Total
    doc.rect(370, rowY, 190, 28).fill(colors.accent);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(12)
      .text('TOTAL', 380, rowY + 8)
      .text(`₹${invoice.totalAmount.toFixed(2)}`, 380, rowY + 8, { width: 170, align: 'right' });
    rowY += 45;

    // Balance Due
    if (invoice.balanceAmount > 0) {
      doc.fillColor(colors.primary).font('Helvetica').fontSize(10)
        .text(`Amount Paid: ₹${invoice.paidAmount.toFixed(2)}`, 380, rowY)
        .text(`Balance Due: ₹${invoice.balanceAmount.toFixed(2)}`, 380, rowY + 15, { oblique: true });
    }

    // ─── Footer ──────────────────────────────────────────────────────────────
    doc.moveTo(50, doc.page.height - 80).lineTo(560, doc.page.height - 80)
      .strokeColor(colors.gray).lineWidth(0.5).stroke();
    doc.fillColor(colors.gray).fontSize(8).font('Helvetica')
      .text('Thank you for your business!', 50, doc.page.height - 65, { align: 'center', width: 510 })
      .text('For queries, contact us at the farm address above.', 50, doc.page.height - 52, { align: 'center', width: 510 });

    doc.end();
  });
}

/**
 * Generate a generic data report PDF
 */
export async function generateReportPDF(
  title: string,
  data: any[],
  columns: string[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a2e').text(title, { align: 'center' });
    doc.fontSize(9).fillColor('#6b7280').text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
    doc.moveDown();

    // Simple table
    const colWidth = Math.floor((doc.page.width - 80) / columns.length);
    let yPos = doc.y;

    // Header
    doc.rect(40, yPos, doc.page.width - 80, 18).fill('#1a1a2e');
    columns.forEach((col, i) => {
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text(col.toUpperCase(), 40 + i * colWidth, yPos + 5, { width: colWidth - 5 });
    });
    yPos += 22;

    // Rows
    data.forEach((row, idx) => {
      if (yPos > doc.page.height - 60) {
        doc.addPage();
        yPos = 40;
      }
      if (idx % 2 === 0) doc.rect(40, yPos - 3, doc.page.width - 80, 16).fill('#f8f9fa');
      doc.fillColor('#1a1a2e').font('Helvetica').fontSize(8);
      columns.forEach((col, i) => {
        const val = String(row[col] ?? '');
        doc.text(val.substring(0, 25), 40 + i * colWidth, yPos, { width: colWidth - 5 });
      });
      yPos += 16;
    });

    doc.end();
  });
}

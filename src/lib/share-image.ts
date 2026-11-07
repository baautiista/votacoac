interface Section { title: string; lines: string[] }
export async function shareImage(title: string, subtitle: string, sections: Section[], filename: string) {
  await document.fonts.ready;
  const width = 1080, margin = 60, gap = 32, column = (width - margin * 2 - gap) / 2;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 1;
  const context = canvas.getContext('2d'); if (!context) throw new Error('No se ha podido generar la imagen.');
  const wrapped = (text: string, max: number, font: string): string[] => {
    context.font = font; const output: string[] = []; let line = '';
    for (const word of text.split(' ')) { const next = line ? line + ' ' + word : word; if (line && context.measureText(next).width > max) { output.push(line); line = word; } else line = next; }
    output.push(line); return output;
  };
  const titleFont = '800 30px "Bricolage Grotesque", Outfit, sans-serif', textFont = '22px "DM Sans", sans-serif';
  const layouts = sections.map(section => { const titleLines = wrapped(section.title, column - 48, titleFont); const lines = section.lines.map(line => wrapped(line, column - 48, textFont)); return { titleLines, lines, height: Math.max(210, 75 + titleLines.length * 36 + lines.reduce((sum, line) => sum + line.length * 29 + 15, 0)) }; });
  const rowHeights = Array.from({ length: Math.ceil(layouts.length / 2) }, (_, i) => Math.max(layouts[i * 2]?.height || 0, layouts[i * 2 + 1]?.height || 0));
  const height = 270 + rowHeights.reduce((sum, h) => sum + h + gap, 0) + 90; canvas.height = height;
  context.fillStyle = '#FBF8F2'; context.fillRect(0, 0, width, height); context.fillStyle = '#3B84FA'; context.fillRect(0, 0, width, 220); context.fillStyle = '#171344'; context.font = '800 50px "Bricolage Grotesque",Outfit,sans-serif'; context.fillText('votaCOAC.', margin, 80); context.font = '800 42px "Bricolage Grotesque",Outfit,sans-serif'; context.fillText(title, margin, 150); context.font = '24px "DM Sans",sans-serif'; context.fillText(subtitle.slice(0, 76), margin, 192);
  const colors = ['#3B84FA', '#F2BE26', '#C92168', '#8BD557'];
  layouts.forEach((layout, index) => { const row = Math.floor(index / 2), x = margin + index % 2 * (column + gap), y = 260 + rowHeights.slice(0, row).reduce((sum, h) => sum + h + gap, 0); context.fillStyle = '#fff'; context.fillRect(x, y, column, rowHeights[row]); context.fillStyle = colors[index % colors.length]; context.fillRect(x, y, column, 8); context.fillStyle = '#171344'; context.font = titleFont; let lineY = y + 52; for (const text of layout.titleLines) { context.fillText(text, x + 24, lineY); lineY += 36; } lineY += 15; context.font = textFont; for (const line of layout.lines) { for (const text of line) { context.fillText(text, x + 24, lineY); lineY += 29; } lineY += 15; } });
  context.fillStyle = '#68647D'; context.font = '19px "DM Sans",sans-serif'; context.fillText('COAC 2027 · Participación popular independiente · votaCOAC', margin, height - 45);
  await downloadCanvas(canvas, filename);
}
export async function shareBingo(card: { cells: { text: string }[]; marked: number[]; lines?: string[]; bingo?: boolean }, subtitle: string, meta: { edition: string; serial: string } = { edition: 'COAC 2027', serial: '' }) {
  await document.fonts.ready; const W = 1200, H = 1640; const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const c = canvas.getContext('2d'); if (!c) throw new Error('No se ha podido generar la imagen.');
  const display = '"Bricolage Grotesque",Outfit,sans-serif', body = '"DM Sans",sans-serif';
  const rounded = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  // fondo y papel
  c.fillStyle = '#3B84FA'; c.fillRect(0, 0, W, H);
  const flags = ['#F2BE26', '#C92168', '#FFFFFF', '#8BD557', '#FF7B2E']; for (let i = 0; i < 20; i++) { c.fillStyle = flags[i % flags.length]; const x = i * 60; c.beginPath(); c.moveTo(x + 6, 0); c.lineTo(x + 54, 0); c.lineTo(x + 30, 44); c.closePath(); c.fill(); }
  const px = 60, py = 90, pw = W - 120, ph = H - 150; c.save(); c.shadowColor = 'rgba(23,19,68,.25)'; c.shadowBlur = 40; c.shadowOffsetY = 18; c.fillStyle = '#FFFDF7'; rounded(px, py, pw, ph, 28); c.fill(); c.restore();
  // cabecera impresa
  c.fillStyle = '#171344'; c.font = `700 22px ${body}`; c.fillText(`VOTACOAC · ${meta.edition.toUpperCase()}`, px + 50, py + 64);
  c.font = `800 76px ${display}`; c.fillText('Bingo del Falla', px + 50, py + 144);
  c.textAlign = 'right'; c.font = `600 20px ${body}`; c.fillStyle = '#5F5B7A'; c.fillText('CARTÓN Nº', px + pw - 50, py + 64); c.fillStyle = '#C92168'; c.font = `800 40px ${display}`; c.fillText(meta.serial || '—', px + pw - 50, py + 110); c.fillStyle = '#5F5B7A'; c.font = `500 22px ${body}`; c.fillText(subtitle.slice(0, 48), px + pw - 50, py + 148); c.textAlign = 'left';
  c.setLineDash([10, 8]); c.strokeStyle = 'rgba(23,19,68,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 40, py + 184); c.lineTo(px + pw - 40, py + 184); c.stroke(); c.setLineDash([]);
  // letras
  const gx = px + 50, gw = pw - 100, gap = 10, size = (gw - gap * 4) / 5, letterColors = ['#3B84FA', '#C92168', '#F2BE26', '#8BD557', '#FF7B2E'];
  'BINGO'.split('').forEach((l, i) => { const x = gx + i * (size + gap); c.fillStyle = letterColors[i]; rounded(x, py + 210, size, 70, 16); c.fill(); c.fillStyle = i === 2 || i === 3 ? '#171344' : '#fff'; c.font = `800 48px ${display}`; c.textAlign = 'center'; c.fillText(l, x + size / 2, py + 262); c.textAlign = 'left'; });
  // casillas
  const top = py + 300; card.cells.forEach((cell, index) => { const x = gx + index % 5 * (size + gap), y = top + Math.floor(index / 5) * (size + gap); c.fillStyle = '#FFFFFF'; rounded(x, y, size, size, 14); c.fill(); c.strokeStyle = 'rgba(23,19,68,.12)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#9A96B3'; c.font = `700 16px ${body}`; c.fillText(String(index + 1).padStart(2, '0'), x + 14, y + 26);
    c.fillStyle = '#171344'; c.font = `600 20px ${body}`; const words = cell.text.split(' '); let line = '', row = 0; for (const word of words) { if (c.measureText(line + word).width > size - 28 && line) { c.fillText(line.trim(), x + 14, y + 60 + row * 26); row++; line = word + ' '; } else line += word + ' '; } c.fillText(line.trim(), x + 14, y + 60 + row * 26);
    if (card.marked.includes(index)) { c.save(); c.globalAlpha = .78; c.fillStyle = letterColors[index % 5]; c.beginPath(); c.arc(x + size / 2, y + size / 2, size * .34, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; c.beginPath(); c.arc(x + size / 2, y + size / 2, size * .26, 0, Math.PI * 2); c.stroke(); c.restore(); } });
  // pie
  const fy = top + 5 * (size + gap) + 30; c.fillStyle = '#171344'; c.font = `800 34px ${display}`; c.fillText(`${card.marked.length}/25 marcadas · ${card.lines?.length ?? 0} líneas${card.bingo ? ' · ¡BINGO!' : ''}`, gx, fy + 20);
  c.fillStyle = '#5F5B7A'; c.font = `500 20px ${body}`; c.fillText('Juego gratuito, sin apuestas ni premios económicos · votaCOAC', gx, py + ph - 36);
  await downloadCanvas(canvas, 'bingo-del-falla-2027.png');
}
async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se ha podido generar el archivo.')), 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'VotaCOAC 2027' }); return; } catch (error) { if ((error as Error).name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}

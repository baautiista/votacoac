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
  const titleFont = '800 30px Outfit, sans-serif', textFont = '22px "DM Sans", sans-serif';
  const layouts = sections.map(section => { const titleLines = wrapped(section.title, column - 48, titleFont); const lines = section.lines.map(line => wrapped(line, column - 48, textFont)); return { titleLines, lines, height: Math.max(210, 75 + titleLines.length * 36 + lines.reduce((sum, line) => sum + line.length * 29 + 15, 0)) }; });
  const rowHeights = Array.from({ length: Math.ceil(layouts.length / 2) }, (_, i) => Math.max(layouts[i * 2]?.height || 0, layouts[i * 2 + 1]?.height || 0));
  const height = 270 + rowHeights.reduce((sum, h) => sum + h + gap, 0) + 90; canvas.height = height;
  context.fillStyle = '#FAF9F6'; context.fillRect(0, 0, width, height); context.fillStyle = '#3B84FA'; context.fillRect(0, 0, width, 220); context.fillStyle = '#171344'; context.font = '800 50px Outfit,sans-serif'; context.fillText('votaCOAC.', margin, 80); context.font = '800 42px Outfit,sans-serif'; context.fillText(title, margin, 150); context.font = '24px "DM Sans",sans-serif'; context.fillText(subtitle.slice(0, 76), margin, 192);
  const colors = ['#3B84FA', '#F2BE26', '#C92168', '#8BD557'];
  layouts.forEach((layout, index) => { const row = Math.floor(index / 2), x = margin + index % 2 * (column + gap), y = 260 + rowHeights.slice(0, row).reduce((sum, h) => sum + h + gap, 0); context.fillStyle = '#fff'; context.fillRect(x, y, column, rowHeights[row]); context.fillStyle = colors[index % colors.length]; context.fillRect(x, y, column, 8); context.fillStyle = '#171344'; context.font = titleFont; let lineY = y + 52; for (const text of layout.titleLines) { context.fillText(text, x + 24, lineY); lineY += 36; } lineY += 15; context.font = textFont; for (const line of layout.lines) { for (const text of line) { context.fillText(text, x + 24, lineY); lineY += 29; } lineY += 15; } });
  context.fillStyle = '#68647D'; context.font = '19px "DM Sans",sans-serif'; context.fillText('COAC 2027 · Participación popular independiente · votaCOAC', margin, height - 45);
  await downloadCanvas(canvas, filename);
}
export async function shareBingo(card: { cells: { text: string }[]; marked: number[] }, subtitle: string) {
  await document.fonts.ready; const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1450; const context = canvas.getContext('2d'); if (!context) throw new Error('No se ha podido generar la imagen.');
  context.fillStyle = '#FAF9F6'; context.fillRect(0, 0, 1200, 1450); context.fillStyle = '#171344'; context.font = '800 65px Outfit,sans-serif'; context.fillText('Bingo del Falla', 65, 100); context.font = '24px "DM Sans",sans-serif'; context.fillText(subtitle.slice(0, 80), 65, 155);
  const size = 210, gap = 8; card.cells.forEach((cell, index) => { const x = 59 + index % 5 * (size + gap), y = 220 + Math.floor(index / 5) * (size + gap); context.fillStyle = card.marked.includes(index) ? '#8BD557' : '#fff'; context.fillRect(x, y, size, size); context.fillStyle = '#171344'; context.font = '700 23px "DM Sans",sans-serif'; const words = cell.text.split(' '); let line = '', row = 0; for (const word of words) { if (context.measureText(line + word).width > size - 28 && line) { context.fillText(line.trim(), x + 14, y + 45 + row * 31); row++; line = word + ' '; } else line += word + ' '; } context.fillText(line.trim(), x + 14, y + 45 + row * 31); });
  context.font = '24px "DM Sans",sans-serif'; context.fillStyle = '#68647D'; context.fillText('votaCOAC · Juego gratuito, sin apuestas ni premios económicos', 65, 1385); await downloadCanvas(canvas, 'bingo-del-falla-2027.png');
}
async function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se ha podido generar el archivo.')), 'image/png'));
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'VotaCOAC 2027' }); return; } catch (error) { if ((error as Error).name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
}

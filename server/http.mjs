export class ApiError extends Error { constructor(status, message, code = 'request_error') { super(message); this.status = status; this.code = code; } }
export const fail = (status, message, code) => { throw new ApiError(status, message, code); };
export const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', ...extra } });
export const clean = (value, max, label, minimum = 1) => { if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > max) fail(400, `Revisa ${label}.`); return value.trim(); };
export const idOf = value => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(value)) fail(400, 'Identificador no válido.'); return value; };
export async function bodyOf(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) fail(415, 'Envía los datos en formato JSON.');
  const limit = new URL(request.url).pathname === '/api/admin/catalog' ? 1048576 : 131072;
  if (Number(request.headers.get('content-length') || 0) > limit) fail(413, 'La petición es demasiado grande.');
  const text = await request.text(); if (text.length > limit) fail(413, 'La petición es demasiado grande.');
  try { const data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Datos no válidos.'); return data; }
  catch (error) { if (error instanceof ApiError) throw error; fail(400, 'No se han podido leer los datos.'); }
}

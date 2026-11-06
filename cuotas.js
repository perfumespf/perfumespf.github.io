// Lógica financiera única, usada por el catálogo y por el panel.
import { MOSTRAR_BAJO_MINIMO } from './config.js';

export const RECARGO = 100000;
export const CUOTA = 100000;
export const PASO = 100000;

export const fmt = (n) => new Intl.NumberFormat('es-PY').format(n);

/** Entrega base según rango de precio contado (hasta 200k→50k, 200–400k→100k, 400–600k→200k, ...). */
export function entregaBase(precio) {
  const tramo = Math.ceil(precio / 200000);
  if (tramo <= 1) return 50000;
  if (tramo === 2) return 100000;
  return (tramo - 1) * 100000;
}

/** Cola: lo que sobra del precio contado al dividirlo en bloques de 100.000. */
export const cola = (precio) => precio % PASO;

/** Entrega mínima = menor valor >= base que conserva la cola (así las cuotas son exactas). */
export function entregaSugerida(precio) {
  const base = entregaBase(precio);
  let e = cola(precio);
  while (e < base) e += PASO;
  return e;
}

/** Entrega total a partir de un monto del operador (múltiplo de 100.000) + cola. */
export function entregaDesdeOperador(precio, monto) {
  if (monto % PASO !== 0 || monto < 0) throw new Error('La entrega debe ser múltiplo de 100.000 Gs.');
  return monto + cola(precio);
}

/** Todos los planes viables a partir de una entrega inicial. */
export function generarPlanes(precio, entregaInicial = null) {
  const financiado = precio + RECARGO;
  const inicio = entregaInicial ?? (MOSTRAR_BAJO_MINIMO ? cola(precio) : entregaSugerida(precio));
  const planes = [];
  for (let e = inicio; financiado - e >= CUOTA; e += PASO) {
    planes.push({ entrega: e, cuotas: (financiado - e) / CUOTA, valor_cuota: CUOTA });
  }
  return planes;
}

export const textoPlan = (p) => `Entrega de PYG ${fmt(p.entrega)} + ${p.cuotas} cuota${p.cuotas > 1 ? 's' : ''} de ${fmt(p.valor_cuota)} Gs.`;

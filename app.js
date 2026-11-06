import { db } from '../shared/supabase.js';
import { WHATSAPP } from '../shared/config.js';
import { fmt, textoPlan } from '../shared/cuotas.js';

const FILTROS = {
  estado: [['todos','Todos'],['disponible','Disponible'],['agotado','Agotado']],
  concentracion: [['todos','Todos'],['EDP','EDP'],['EDT','EDT']],
  genero: [['todos','Todos'],['hombre','Hombre'],['mujer','Mujer']],
};
const activo = { estado:'todos', concentracion:'todos', genero:'todos' };
let perfumes = [];

const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach(k => n.append(k));
  return n;
};

function renderFiltros() {
  const box = document.getElementById('filters');
  box.replaceChildren(...Object.entries(FILTROS).map(([clave, opts]) =>
    el('div', { className:'group', role:'group' },
      opts.map(([val, txt]) => {
        const b = el('button', { className:'chip', textContent:txt });
        b.setAttribute('aria-pressed', activo[clave] === val);
        b.onclick = () => { activo[clave] = val; renderFiltros(); renderGrid(); };
        return b;
      }))));
}

function tarjeta(p) {
  const msg = encodeURIComponent(`Hola! Quiero consultar por ${p.nombre} (${p.marca}) - PYG ${fmt(p.precio_contado)}`);
  const agotado = p.estado === 'agotado';
  const btn = el('a', { className:'btn', textContent:'CONSULTAR', href:`https://wa.me/${WHATSAPP}?text=${msg}`, target:'_blank', rel:'noopener' });
  const planes = [...(p.planes_cuota ?? [])].sort((a, b) => a.entrega - b.entrega);
  const sel = el('select', { ariaLabel:'Forma de pago' },
    el('option', { value:'', textContent:'Forma de pago' }),
    el('option', { textContent:`Pago unico PYG ${fmt(p.precio_contado)}` }),
    p.admite_cuotas ? planes.map(pl => el('option', { textContent:textoPlan(pl) })) : []);
  return el('article', { className:'card' },
    el('img', { src:p.imagen_url, alt:`${p.nombre} ${p.marca}`, loading:'lazy' }),
    el('div', { className:'estado' + (agotado ? ' agotado' : ''), textContent: agotado ? 'Agotado' : 'Disponible' }),
    el('h2', { textContent:p.nombre }),
    el('div', { className:'marca', textContent:p.marca }),
    el('p', { className:'desc', textContent:p.descripcion ?? '' }),
    btn, sel);
}

function renderGrid() {
  const lista = perfumes.filter(p => Object.entries(activo).every(([k, v]) => v === 'todos' || p[k] === v));
  document.getElementById('grid').replaceChildren(
    ...(lista.length ? lista.map(tarjeta) : [el('p', { className:'vacio', textContent:'No hay perfumes con esos filtros.' })]));
}

const { data, error } = await db.from('perfumes').select('*, planes_cuota(*)').order('creado_en', { ascending:false });
if (error) document.getElementById('grid').textContent = 'No se pudo cargar el catálogo. Intentá de nuevo.';
else { perfumes = data; renderFiltros(); renderGrid(); }

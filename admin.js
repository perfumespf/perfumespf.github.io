import { db } from '../shared/supabase.js';
import { SCENTO_BASES } from '../shared/config.js';
import { fmt, cola, entregaBase, entregaSugerida, entregaDesdeOperador, generarPlanes, textoPlan } from '../shared/cuotas.js';

const $ = (id) => document.getElementById(id);
const msg = (t) => ($('msg').textContent = t);
let planes = [];

// ---- Auth ----
async function sesion() {
  const { data } = await db.auth.getSession();
  $('login').hidden = !!data.session; $('alta').hidden = !data.session;
}
$('login').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const { error } = await db.auth.signInWithPassword({ email:f.get('email'), password:f.get('pass') });
  if (error) alert('Email o contraseña incorrectos.');
  sesion();
};
sesion();

// ---- API Scento (gratuita, sin clave, CORS abierto) + traducción ----
const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
let detalleAPI = null;

async function scento(path) {
  let err;
  for (const base of SCENTO_BASES) {            // mismo respaldo de host que el catálogo anterior
    try { const r = await fetch(base + path); if (r.ok) return r.json(); err = new Error('HTTP ' + r.status); }
    catch (e) { err = e; }
  }
  throw err;
}

// MyMemory (gratis, ~500 caracteres por consulta). Los textos aquí son cortos (familia, notas).
async function traducir(texto) {
  if (!texto) return '';
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|es`).then(r => r.json());
    return r.responseData?.translatedText ?? texto;
  } catch { return texto; }
}

$('nombre').addEventListener('input', debounce(async (e) => {
  const q = e.target.value.trim(); const ul = $('sugs');
  if (q.length < 3) return (ul.hidden = true);
  try {
    const s = await scento(`/search?q=${encodeURIComponent(q)}&kind=perfume`);
    const matches = s.detail?.matches ?? [];
    ul.replaceChildren(...matches.slice(0, 8).map(m => {
      const li = Object.assign(document.createElement('li'), { textContent:`${m.name} — ${m.house}` });
      li.onclick = () => autocompletar(m);
      return li;
    }));
    ul.hidden = !matches.length;
  } catch { msg('No se pudo consultar la API de aromas. Podés completar los datos a mano.'); }
}));

async function autocompletar(m) {
  const f = $('alta').elements;
  $('sugs').hidden = true; msg('Cargando datos del perfume…');
  let d = { name:m.name, house:m.house, family:m.family };
  try {
    const slug = (m.page || '').split('/perfumes/')[1];
    if (slug) d = (await scento('/perfumes/' + slug)).detail ?? d;
  } catch { /* queda la ficha parcial: al menos nombre, casa y familia */ }
  detalleAPI = d;

  f.nombre.value = d.name; f.marca.value = d.house;
  if (d.concentration) f.concentracion.value = /parfum|edp/i.test(d.concentration) ? 'EDP' : /toilette|edt/i.test(d.concentration) ? 'EDT' : 'OTRO';

  msg('Traduciendo al español…');
  const py = d.pyramid ?? {};
  const listaNotas = [...(py.top ?? []), ...(py.heart ?? []), ...(py.base ?? [])];
  const [fam, nts] = await Promise.all([traducir(d.family), traducir(listaNotas.join(', '))]);
  f.familia.value = fam;
  f.notas.value = nts;
  // La API no trae descripción ni género: se arma con el mismo formato del catálogo actual.
  const para = { hombre:'Hombres', mujer:'Mujeres', unisex:'Hombres y Mujeres' }[f.genero.value];
  f.descripcion.value = `${d.name} de ${d.house} es una fragancia de la familia olfativa ${fam}${para ? ' para ' + para : ''}.`;
  msg('Datos cargados. Revisá el género y subí la imagen.');
}

// ---- Simulador de entrega ----
function simular() {
  const precio = Number($('precio').value);
  $('simulador').hidden = !($('admite').checked && precio > 0);
  if ($('simulador').hidden) return;
  try {
    const entrega = entregaDesdeOperador(precio, Number($('entrega').value || 0));
    planes = generarPlanes(precio, entrega);
    $('resumen').textContent = `Base: ${fmt(entregaBase(precio))} · Cola: ${fmt(cola(precio))} · Entrega total: ${fmt(entrega)} Gs.`
      + (entrega < entregaBase(precio) ? ' (menor a la base recomendada)' : '');
    $('tabla').innerHTML = '<tr><th>Planes que se guardarán</th></tr>' + planes.map(p => `<tr><td>${textoPlan(p)}</td></tr>`).join('');
  } catch (err) { planes = []; $('resumen').textContent = err.message; $('tabla').innerHTML = ''; }
}
$('sugerir').onclick = () => { const p = Number($('precio').value); $('entrega').value = entregaSugerida(p) - cola(p); simular(); };
['precio','admite','entrega'].forEach(id => $(id).addEventListener('input', simular));

// ---- Guardar ----
$('alta').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (f.cuotas.checked && !planes.length) return msg('Definí una entrega válida para generar las cuotas.');
  msg('Guardando…');
  const archivo = f.imagen.files[0];
  const ruta = `${crypto.randomUUID()}.${archivo.name.split('.').pop()}`;
  const up = await db.storage.from('perfumes').upload(ruta, archivo);
  if (up.error) return msg('No se pudo subir la imagen: ' + up.error.message);
  const imagen_url = db.storage.from('perfumes').getPublicUrl(ruta).data.publicUrl;

  const { data, error } = await db.from('perfumes').insert({
    nombre:f.nombre.value, marca:f.marca.value, concentracion:f.concentracion.value, genero:f.genero.value,
    precio_contado:Number(f.precio.value), imagen_url, familia_olfativa:f.familia.value,
    descripcion:f.descripcion.value, notas:{ texto:f.notas.value, piramide:detalleAPI?.pyramid ?? null },
    detalles: detalleAPI ? { year:detalleAPI.year, perfumer:detalleAPI.perfumer, concentration:detalleAPI.concentration, subfamily:detalleAPI.subfamily, slug:detalleAPI.slug } : {}, admite_cuotas:f.cuotas.checked,
  }).select().single();
  if (error) return msg('Error: ' + error.message);

  if (f.cuotas.checked) {
    const { error: e2 } = await db.from('planes_cuota').insert(planes.map(p => ({ ...p, perfume_id:data.id })));
    if (e2) return msg('Perfume guardado, pero fallaron las cuotas: ' + e2.message);
  }
  msg('Perfume guardado.'); detalleAPI = null; e.target.reset(); $('simulador').hidden = true;
};

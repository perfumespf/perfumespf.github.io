import { db } from '../shared/supabase.js';
import { PERFUME_API_URL } from '../shared/config.js';
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

// ---- API de fragancias + traducción ----
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// MyMemory (gratis, ~500 caracteres por consulta): se parte por oraciones.
async function traducir(texto) {
  if (!texto) return '';
  const partes = texto.match(/[^.!?]+[.!?]*/g) ?? [texto];
  const out = []; let bloque = '';
  const enviar = async () => {
    if (!bloque) return;
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(bloque)}&langpair=en|es`).then(r => r.json());
    out.push(r.responseData?.translatedText ?? bloque); bloque = '';
  };
  for (const p of partes) { if ((bloque + p).length > 450) await enviar(); bloque += p; }
  await enviar();
  return out.join(' ');
}

$('nombre').addEventListener('input', debounce(async (e) => {
  const q = e.target.value.trim(); const ul = $('sugs');
  if (q.length < 3) return (ul.hidden = true);
  try {
    // Contrato esperado: [{ name, brand, gender, concentration, family, description, notes:{top,heart,base}, image }]
    const res = await fetch(`${PERFUME_API_URL}?q=${encodeURIComponent(q)}`).then(r => r.json());
    ul.replaceChildren(...res.slice(0, 6).map(r => {
      const li = Object.assign(document.createElement('li'), { textContent:`${r.name} — ${r.brand}` });
      li.onclick = () => autocompletar(r);
      return li;
    }));
    ul.hidden = !res.length;
  } catch { msg('No se pudo consultar la API de fragancias. Podés completar los datos a mano.'); }
}));

async function autocompletar(r) {
  const f = $('alta').elements;
  $('sugs').hidden = true;
  f.nombre.value = r.name; f.marca.value = r.brand;
  if (r.concentration) f.concentracion.value = /parfum|edp/i.test(r.concentration) ? 'EDP' : /toilette|edt/i.test(r.concentration) ? 'EDT' : 'OTRO';
  if (r.gender) f.genero.value = /women|mujer|female/i.test(r.gender) ? 'mujer' : /men|hombre|male/i.test(r.gender) ? 'hombre' : 'unisex';
  msg('Traduciendo al español…');
  const notas = Object.values(r.notes ?? {}).flat().join(', ');
  const [fam, desc, nts] = await Promise.all([traducir(r.family), traducir(r.description), traducir(notas)]);
  f.familia.value = fam;
  f.descripcion.value = desc || `${r.name} de ${r.brand} es una fragancia de la familia olfativa ${fam}.`;
  f.notas.value = nts; msg('');
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
    descripcion:f.descripcion.value, notas:{ texto:f.notas.value }, admite_cuotas:f.cuotas.checked,
  }).select().single();
  if (error) return msg('Error: ' + error.message);

  if (f.cuotas.checked) {
    const { error: e2 } = await db.from('planes_cuota').insert(planes.map(p => ({ ...p, perfume_id:data.id })));
    if (e2) return msg('Perfume guardado, pero fallaron las cuotas: ' + e2.message);
  }
  msg('Perfume guardado.'); e.target.reset(); $('simulador').hidden = true;
};

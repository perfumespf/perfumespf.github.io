export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
export const WHATSAPP = '595981000000'; // sin + ni espacios
// false = entrega mínima según reglas (base + cola). true = también ofrece desde la cola sola (como el catálogo actual).
export const MOSTRAR_BAJO_MINIMO = false;
// Endpoint propio (Edge Function) que consulta la API de fragancias.
export const PERFUME_API_URL = `${SUPABASE_URL}/functions/v1/perfume-search`;

export const SUPABASE_URL = 'https://nxgxecrmffzdhhyqonrm.supabase.co/rest/v1/';
export const SUPABASE_ANON_KEY = 'sb_publishable_N0zux6qJsyStJ1KUAEU20Q_-6CCmVKv';
export const WHATSAPP = '595991567839'; // sin + ni espacios
// false = entrega mínima según reglas (base + cola). true = también ofrece desde la cola sola (como el catálogo actual).
export const MOSTRAR_BAJO_MINIMO = false;
// Endpoint propio (Edge Function) que consulta la API de fragancias.
export const PERFUME_API_URL = `${SUPABASE_URL}/functions/v1/perfume-search`;

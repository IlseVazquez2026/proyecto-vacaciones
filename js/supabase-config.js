/**
 * supabase-config.js - Configuración de la conexión a la nube
 */

const SUPABASE_URL = 'https://majzihiuqfzhnjtcefik.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fUVU309hDGX5SdArviDNEw_s1aK0RmM';

// Inicializar el cliente de Supabase
// El CDN expone un objeto global llamado 'supabase'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabase = supabaseClient;


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key are not set in your .env file. Please create one based on the README instructions.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: async (url, options) => {
        // Convert RequestInfo | URL to string for string checks
        const urlStr = typeof url === 'string' ? url : url.toString();

        // Bypass the aggressive timeout for storage uploads (which can be long-running)
        if (urlStr.includes('/storage/v1/object/')) {
            return fetch(url, options);
        }

        // Do not apply timeout to requests that already have a signal (e.g., from realtime)
        if (options?.signal) {
          return fetch(url, options);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.warn(`Supabase request timed out: ${urlStr}`);
            controller.abort();
        }, 30000); // 30s timeout

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          return response;
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            throw new Error('Request timed out. Please check your network connection.');
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
  });

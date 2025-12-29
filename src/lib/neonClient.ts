
import { neon } from '@neondatabase/serverless';

const databaseUrl = import.meta.env.VITE_NEON_DATABASE_URL;

if (!databaseUrl) {
    throw new Error("Neon Database URL is not set in your .env file (VITE_NEON_DATABASE_URL).");
}

// Neon serverless driver allows for low-latency SQL queries via HTTP
export const sql = neon(databaseUrl);

// Helper to execute queries and return camelCase results
export const query = async <T = any>(sqlString: string, params: any[] = []): Promise<T[]> => {
    try {
        const result = await sql(sqlString, params);
        // Neon returns rows as objects, we just need to ensure the calling context handles the case conversion if needed
        return result as unknown as T[];
    } catch (error) {
        console.error("Database query failed:", error);
        throw error;
    }
};

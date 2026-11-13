export interface DbUsageTable {
    name: string;
    bytes: number;
}

export interface DbUsageResponse {
    sizeBytes: number;
    tables: DbUsageTable[];
}

export function formatStorageBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;

    if (bytes >= GB) {
        const val = bytes / GB;
        return `${Number.isInteger(val) ? val : Number(val.toFixed(2))} GB`;
    }
    if (bytes >= MB) {
        const val = bytes / MB;
        return `${val >= 10 ? Math.round(val) : Number(val.toFixed(1))} MB`;
    }
    if (bytes >= KB) {
        const val = bytes / KB;
        return `${val >= 10 ? Math.round(val) : Number(val.toFixed(1))} KB`;
    }
    return `${Math.round(bytes)} B`;
}

export async function fetchDbUsage(): Promise<DbUsageResponse> {
    const res = await fetch('/api/db-usage', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (typeof data?.sizeBytes !== 'number' || !Array.isArray(data?.tables)) {
        throw new Error('Invalid response');
    }
    return {
        sizeBytes: data.sizeBytes,
        tables: data.tables.map((t: any) => ({
            name: String(t.name),
            bytes: Number(t.bytes)
        }))
    };
}

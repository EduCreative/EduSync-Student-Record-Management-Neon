// A more robust CSV parser that handles quoted fields and escaped quotes.
export const parseCsv = (csvText: string): { data: Record<string, any>[], errors: string[] } => {
    let text = csvText.trim();
    // Handle BOM (Byte Order Mark)
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
    }
    const lines = text.split(/\r\n|\n/);
    const errors: string[] = [];
    
    if (lines.length < 2 || !lines[0].trim()) {
        errors.push("File must have a header row and at least one data row.");
        return { data: [], errors };
    }

    // Trim quotes and whitespace from headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values: string[] = [];
        let currentValue = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                if (inQuotes && j < line.length - 1 && line[j + 1] === '"') {
                    currentValue += '"'; // Escaped quote
                    j++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue);

        // Handle potential trailing comma
        if (values.length === headers.length + 1 && values[values.length - 1].trim() === '') {
            values.pop();
        }

        if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Expected ${headers.length} columns, but found ${values.length}. Skipping row.`);
            continue;
        }
        
        const row: Record<string, any> = {};
        headers.forEach((header, index) => {
            let value = (values[index] || '').trim();
            // Remove surrounding quotes if they exist
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            // Un-escape double quotes
            row[header] = value.replace(/""/g, '"');
        });
        
        data.push(row);
    }
    return { data, errors };
};

export const escapeCsvCell = (value: any): string => {
    if (value === null || value === undefined) {
        return '';
    }
    let stringValue = String(value);

    // If the value contains a comma, a double quote, or a newline, it needs to be quoted.
    if (/[",\n\r]/.test(stringValue)) {
        // Escape double quotes by doubling them
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }

    return stringValue;
};

export const downloadCsvString = (csvContent: string, fileName: string) => {
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

export const exportToCsv = (data: any[], fileName: string) => {
    if (!data || data.length === 0) {
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.map(escapeCsvCell).join(','), // Header row
        ...data.map(row =>
            headers.map(header => escapeCsvCell(row[header])).join(',')
        )
    ];
    
    downloadCsvString(csvRows.join('\n'), fileName);
};
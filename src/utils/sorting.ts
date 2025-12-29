const numberWords: { [key: string]: number } = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12
};

export const getClassLevel = (name: string): number => {
    const lowerName = name.toLowerCase().trim();
    // Normalize by removing spaces and hyphens for keyword matching
    const normalizedName = lowerName.replace(/[\s-]+/g, '');

    if (normalizedName.includes('playgroup')) return -5;
    if (normalizedName.includes('nursery')) return -4;
    if (normalizedName.includes('kg')) return -3; // Covers KG, K.G., etc.
    if (normalizedName.includes('junior')) return -2;
    if (normalizedName.includes('senior')) return -1;

    let level = 1000; // Default for non-standard names to appear last

    // Check for numeric digits first (e.g., "Class 1", "Grade-8")
    const digitMatch = name.match(/\d+/);
    if (digitMatch) {
        level = parseInt(digitMatch[0], 10);
    } else {
        // If no digits, check for number words (e.g., "Class One")
        const nameParts = lowerName.split(/[\s-]/);
        for (const word in numberWords) {
            if (nameParts.includes(word)) {
                level = numberWords[word];
                break; // Found a number word, stop searching
            }
        }
    }

    // Handle modifiers like "passed" to sort them after the base class
    if (lowerName.includes('passed')) {
        return level + 0.5;
    }
    
    return level;
};

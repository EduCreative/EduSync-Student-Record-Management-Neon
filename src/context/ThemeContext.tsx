

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type FontSize = 'sm' | 'base' | 'lg';
type SyncMode = 'offline' | 'online';
const FONT_SIZES: FontSize[] = ['sm', 'base', 'lg'];

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    fontSize: FontSize;
    increaseFontSize: () => void;
    decreaseFontSize: () => void;
    resetFontSize: () => void;
    highlightMissingData: boolean;
    toggleHighlightMissingData: () => void;
    syncMode: SyncMode;
    setSyncMode: (mode: SyncMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('light');
    const [fontSize, setFontSizeState] = useState<FontSize>('base');
    const [highlightMissingData, setHighlightMissingData] = useState<boolean>(true);
    const [syncMode, setSyncModeState] = useState<SyncMode>('offline');

    useEffect(() => {
        // Theme initialization
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (storedTheme) {
            setTheme(storedTheme);
        } else if (prefersDark) {
            setTheme('dark');
        }

        // Font size initialization
        const storedFontSize = localStorage.getItem('fontSize') as FontSize | null;
        if (storedFontSize) {
            setFontSizeState(storedFontSize);
        }

        // Highlight missing data initialization
        const storedHighlight = localStorage.getItem('highlightMissingData');
        setHighlightMissingData(storedHighlight === null ? true : storedHighlight === 'true');

        // Sync mode initialization
        const storedSyncMode = localStorage.getItem('syncMode') as SyncMode | null;
        setSyncModeState(storedSyncMode || 'offline');
    }, []);

    // Effect to apply theme class to <html> element
    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);

    // Effect to apply root font size for scaling
    useEffect(() => {
        const root = document.documentElement;
        if (fontSize === 'sm') {
            root.style.fontSize = '14px'; // ~87.5%
        } else if (fontSize === 'lg') {
            root.style.fontSize = '18px'; // ~112.5%
        } else { // 'base'
            root.style.fontSize = '16px'; // 100%
        }
    }, [fontSize]);

    const toggleTheme = () => {
        setTheme(prevTheme => {
            const newTheme = prevTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            return newTheme;
        });
    };
    
    const applyFontSize = (size: FontSize) => {
        localStorage.setItem('fontSize', size);
        setFontSizeState(size);
    };

    const increaseFontSize = () => {
        const currentIndex = FONT_SIZES.indexOf(fontSize);
        if (currentIndex < FONT_SIZES.length - 1) {
            applyFontSize(FONT_SIZES[currentIndex + 1]);
        }
    };

    const decreaseFontSize = () => {
        const currentIndex = FONT_SIZES.indexOf(fontSize);
        if (currentIndex > 0) {
            applyFontSize(FONT_SIZES[currentIndex - 1]);
        }
    };

    const resetFontSize = () => {
        applyFontSize('base');
    };

    const toggleHighlightMissingData = () => {
        setHighlightMissingData(prev => {
            const newValue = !prev;
            localStorage.setItem('highlightMissingData', String(newValue));
            return newValue;
        });
    };
    
    const setSyncMode = (mode: SyncMode) => {
        localStorage.setItem('syncMode', mode);
        setSyncModeState(mode);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, fontSize, increaseFontSize, decreaseFontSize, resetFontSize, highlightMissingData, toggleHighlightMissingData, syncMode, setSyncMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
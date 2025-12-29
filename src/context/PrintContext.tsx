
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface PrintContextType {
    showPrintPreview: (content: ReactNode, title: string) => void;
    hidePrintPreview: () => void;
    printContent: ReactNode | null;
    printTitle: string;
    isPrinting: boolean;
}

const PrintContext = createContext<PrintContextType | undefined>(undefined);

export const PrintProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [printContent, setPrintContent] = useState<ReactNode | null>(null);
    const [printTitle, setPrintTitle] = useState('');

    const showPrintPreview = useCallback((content: ReactNode, title: string) => {
        setPrintContent(content);
        setPrintTitle(title);
    }, []);

    const hidePrintPreview = useCallback(() => {
        setPrintContent(null);
        setPrintTitle('');
    }, []);

    const value = {
        showPrintPreview,
        hidePrintPreview,
        printContent,
        printTitle,
        isPrinting: printContent !== null,
    };

    return (
        <PrintContext.Provider value={value}>
            {children}
        </PrintContext.Provider>
    );
};

export const usePrint = (): PrintContextType => {
    const context = useContext(PrintContext);
    if (!context) {
        throw new Error('usePrint must be used within a PrintProvider');
    }
    return context;
};

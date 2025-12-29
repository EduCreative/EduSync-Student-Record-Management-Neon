import React, { useState, useCallback } from 'react';
import { usePrint } from '../../context/PrintContext';

const ZoomInIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;
const ZoomOutIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>;


const PrintPreview: React.FC = () => {
    const { printContent, printTitle, hidePrintPreview } = usePrint();
    const [zoom, setZoom] = useState(1);

    const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
        if (direction === 'reset') {
            setZoom(1);
        } else {
            setZoom(prev => {
                const newZoom = direction === 'in' ? prev + 0.1 : prev - 0.1;
                return Math.max(0.2, Math.min(newZoom, 3)); // Clamp zoom
            });
        }
    }, []);

    if (!printContent) {
        return null;
    }
    
    const handlePrint = () => {
        const contentToPrint = document.getElementById('print-content-container');
        if (!contentToPrint) {
            console.error("Print content container not found.");
            alert("Could not find content to print. Please try again.");
            return;
        }

        // Correctly capture all styles, including linked stylesheets with absolute paths.
        const headTags = document.querySelectorAll('head > style, head > link[rel="stylesheet"]');
        let headHTML = '';
        headTags.forEach(tag => {
             if (tag.tagName === 'LINK') {
                // The .href property on a link element gives the full absolute URL,
                // which is crucial for it to work inside a blob-based iframe.
                headHTML += `<link rel="stylesheet" href="${(tag as HTMLLinkElement).href}">`;
            } else {
                headHTML += tag.outerHTML;
            }
        });

        const printHTML = `
            <!DOCTYPE html>
            <html lang="en" class="${document.documentElement.className}">
                <head>
                    <meta charset="UTF-8" />
                    <title>${printTitle}</title>
                    ${headHTML}
                </head>
                <body class="bg-white">
                    ${contentToPrint.innerHTML}
                </body>
            </html>
        `;

        const blob = new Blob([printHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.id = 'print-frame-id';
        
        const cleanup = () => {
            URL.revokeObjectURL(url);
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        };

        iframe.onload = () => {
            try {
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    // Use `afterprint` event for reliable cleanup after the print dialog closes.
                    iframe.contentWindow.addEventListener('afterprint', cleanup);
                    iframe.contentWindow.print();
                } else {
                     throw new Error("Could not access print window.");
                }
            } catch (e) {
                console.error("Printing failed:", e);
                alert("There was a problem preparing the page for printing. Please try again.");
                cleanup(); // Ensure cleanup happens even if printing fails.
            }
        };
        
        iframe.src = url;
        document.body.appendChild(iframe);
    };

    const PrinterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>;
    const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

    return (
        <div className="fixed inset-0 bg-secondary-200 dark:bg-secondary-900 z-[100] flex flex-col print-preview-root">
            <header className="no-print bg-white dark:bg-secondary-800 shadow-md p-3 flex justify-between items-center shrink-0">
                <h2 className="text-lg font-bold text-secondary-900 dark:text-white">{printTitle}</h2>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center rounded-lg bg-secondary-100 dark:bg-secondary-700">
                        <button onClick={() => handleZoom('out')} className="p-2 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600 rounded-l-lg" aria-label="Zoom out" title="Zoom out"><ZoomOutIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleZoom('reset')} className="px-3 py-2 text-sm font-medium text-secondary-700 dark:text-secondary-200 border-x dark:border-secondary-600" title="Reset zoom">{(zoom * 100).toFixed(0)}%</button>
                        <button onClick={() => handleZoom('in')} className="p-2 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600 rounded-r-lg" aria-label="Zoom in" title="Zoom in"><ZoomInIcon className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={handlePrint} 
                            className="btn-primary"
                        >
                            <PrinterIcon />
                            <span>Print / Save</span>
                        </button>
                        <button 
                            onClick={hidePrintPreview} 
                            className="btn-secondary"
                        >
                            <CloseIcon />
                            <span>Close</span>
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="flex-1 overflow-auto p-4 md:p-8 flex justify-center">
                <div
                    id="print-content-container"
                    className="bg-white shadow-xl"
                    style={{
                        width: '210mm', // A4 page width
                        maxWidth: '100%', // Crucial for responsiveness on small screens
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                        transition: 'transform 0.2s ease-out'
                    }}
                >
                    {printContent}
                </div>
            </main>
        </div>
    );
};

export default PrintPreview;
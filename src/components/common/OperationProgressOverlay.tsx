
import React from 'react';

interface OperationProgressOverlayProps {
    progress: {
        percentage: number;
        status: string;
    };
}

const OperationProgressOverlay: React.FC<OperationProgressOverlayProps> = ({ progress }) => {
    if (progress.percentage === 0) return null;
    
    return (
        <div className="fixed inset-0 z-[100] bg-secondary-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-secondary-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-primary-500/30 transform animate-fade-in">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center relative">
                        <svg className="w-12 h-12 text-primary-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary-700">{progress.percentage}%</span>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-secondary-900 dark:text-white">Secure Data Processing</h3>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 min-h-[40px] italic">"{progress.status}"</p>
                    </div>
                    <div className="w-full space-y-2">
                        <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-tighter text-primary-600">
                            <span>Processing chunks...</span>
                            <span>{progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-secondary-100 dark:bg-secondary-700 rounded-full h-3 overflow-hidden border dark:border-secondary-600">
                            <div 
                                className="bg-primary-600 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(37,99,235,0.6)]" 
                                style={{ width: `${progress.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-2 rounded-lg">
                        <p className="text-[10px] text-red-600 dark:text-red-400 uppercase font-black animate-pulse">Critical: Do not exit or refresh browser</p>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default OperationProgressOverlay;

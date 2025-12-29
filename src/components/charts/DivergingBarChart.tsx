import React, { useState, type FC } from 'react';

export interface DivergingBarChartData {
    id: string;
    label: string;
    value1: number; // e.g., Male
    value2: number; // e.g., Female
}

interface DivergingBarChartProps {
    title: string;
    data: DivergingBarChartData[];
    labels: { value1: string; value2: string };
    colors: { value1: string; value2: string };
    onClick?: (item: DivergingBarChartData) => void;
}

const DivergingBarChart: FC<DivergingBarChartProps> = ({ title, data, labels, colors, onClick }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number } | null>(null);

    if (!data || data.length === 0) {
        return (
             <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg h-full">
                <h2 className="text-xl font-semibold mb-2">{title}</h2>
                <div className="flex items-center justify-center h-48 text-secondary-500">
                    No data to display
                </div>
            </div>
        );
    }
    
    const maxValue = Math.max(1, ...data.map(d => Math.max(d.value1, d.value2)));

    const handleMouseOver = (e: React.MouseEvent, content: string) => {
        setTooltip({ visible: true, content, x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };
    
    return (
        <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg h-full" onMouseLeave={handleMouseOut}>
            {tooltip?.visible && (
                <div 
                    className="chart-tooltip" 
                    style={{ 
                        position: 'fixed', 
                        left: tooltip.x, 
                        top: tooltip.y, 
                        transform: 'translate(10px, 10px)'
                    }}
                >
                    {tooltip.content}
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{title}</h2>
                <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center"><span className="w-3 h-3 rounded-sm mr-1.5" style={{ backgroundColor: colors.value1 }}></span>{labels.value1}</div>
                    <div className="flex items-center"><span className="w-3 h-3 rounded-sm mr-1.5" style={{ backgroundColor: colors.value2 }}></span>{labels.value2}</div>
                </div>
            </div>

            <div className="space-y-2">
                {data.map((item) => (
                    <div 
                        key={item.id} 
                        className={`grid grid-cols-[1fr_auto_1fr] gap-2 items-center group ${onClick ? 'cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-700/50 rounded-md p-1 -m-1' : ''}`}
                        onClick={() => onClick && onClick(item)}
                        onMouseMove={handleMouseMove}
                    >
                        {/* Bar 1 (left) */}
                        <div className="flex justify-end items-center" 
                             onMouseOver={(e) => handleMouseOver(e, `${item.label} - ${labels.value1}: ${item.value1}`)}
                        >
                            <span className="text-xs font-semibold mr-2 text-secondary-700 dark:text-secondary-300">{item.value1 > 0 ? item.value1 : ''}</span>
                            <div className="h-5 rounded-l-md transition-all duration-500 ease-out group-hover:brightness-110" 
                                 style={{ 
                                     width: `${(item.value1 / maxValue) * 100}%`, 
                                     backgroundColor: colors.value1 
                                 }}
                            ></div>
                        </div>
                        
                        {/* Label */}
                        <div 
                            className="text-center px-1 sm:px-2 w-28 sm:w-32 shrink-0"
                            onMouseOver={(e) => handleMouseOver(e, `${item.label} - Total: ${item.value1 + item.value2}`)}
                        >
                            <div className="text-sm font-medium text-secondary-600 dark:text-secondary-400 group-hover:font-bold truncate" title={item.label}>
                                {item.label}
                            </div>
                            <div className="text-xs text-secondary-500 dark:text-secondary-400 font-semibold">
                                {item.value1 + item.value2}
                            </div>
                        </div>

                        {/* Bar 2 (right) */}
                        <div className="flex items-center"
                             onMouseOver={(e) => handleMouseOver(e, `${item.label} - ${labels.value2}: ${item.value2}`)}
                        >
                            <div className="h-5 rounded-r-md transition-all duration-500 ease-out group-hover:brightness-110" 
                                 style={{ 
                                     width: `${(item.value2 / maxValue) * 100}%`, 
                                     backgroundColor: colors.value2 
                                 }}
                            ></div>
                            <span className="text-xs font-semibold ml-2 text-secondary-700 dark:text-secondary-300">{item.value2 > 0 ? item.value2 : ''}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DivergingBarChart;
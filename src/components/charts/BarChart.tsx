import React, { useState, useEffect, type FC, type ReactNode } from 'react';

// FIX: Export the BarChartData interface so it can be used in other components.
export interface BarChartData {
    label: string;
    value: number; // Total value for the bar
    color?: string;
    segments?: { value: number; color: string; label: string }[];
    [key: string]: any;
}

interface BarChartProps {
    title: ReactNode;
    data: BarChartData[];
    color?: string;
    onClick?: (item: BarChartData) => void;
    multiColor?: boolean;
    showValuesOnTop?: boolean;
    showValuesOnBottom?: boolean;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#64748b'];

const BarChart: FC<BarChartProps> = ({ title, data, color = '#3b82f6', onClick, multiColor = false, showValuesOnTop = false, showValuesOnBottom = false }) => {
    const [isAnimated, setIsAnimated] = useState(false);
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number } | null>(null);

    useEffect(() => {
        // A short delay helps ensure the CSS transition is applied correctly on mount
        const timer = setTimeout(() => setIsAnimated(true), 100);
        return () => clearTimeout(timer);
    }, [data]);


    if (data.length === 0 || data.every(d => d.value === 0)) {
        return (
             <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg h-full">
                <div className="text-xl font-semibold mb-2">{title}</div>
                <div className="flex items-center justify-center h-48 text-secondary-500">
                    No data to display
                </div>
            </div>
        );
    }
    
    const maxValue = Math.max(...data.map(item => item.value), 0);

    const handleMouseOver = (e: React.MouseEvent, item: BarChartData) => {
        setTooltip({
            visible: true,
            content: `${item.label}: ${item.value.toLocaleString()}`,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };
    
    const legendItems = data[0]?.segments?.map(s => ({ label: s.label, color: s.color }));

    return (
        <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg h-full" onMouseLeave={handleMouseOut}>
             {tooltip?.visible && (
                <div 
                    className="chart-tooltip" 
                    style={{ 
                        position: 'fixed', 
                        left: tooltip.x, 
                        top: tooltip.y, 
                        transform: 'translate(-50%, -120%)'
                    }}
                >
                    {tooltip.content}
                </div>
            )}
            <div className="mb-4">{title}</div>
            
            {legendItems && (
                <div className="flex justify-center gap-4 text-xs mb-2">
                    {legendItems.map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }}></span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="w-full overflow-x-auto pb-4">
                <div className="flex items-end h-48 space-x-2" style={{ minWidth: `${data.length * 40}px` }}>
                    {data.map((item, index) => (
                        <div 
                            key={index} 
                            className="flex flex-col items-center flex-1 group h-full justify-end relative" 
                            onClick={() => onClick && onClick(item)}
                        >
                            {showValuesOnTop && item.value > 0 && (
                                <span 
                                    className="absolute text-xs font-bold text-secondary-700 dark:text-secondary-300 transition-all duration-300"
                                    style={{
                                        bottom: `calc(${(item.value / maxValue) * 100}% + 4px)`,
                                        left: '50%',
                                        transform: 'translateX(-50%)'
                                    }}
                                >
                                    {item.value}
                                </span>
                            )}
                            <div 
                                className={`w-full rounded-t-md bar-item flex flex-col-reverse ${onClick ? 'cursor-pointer' : ''}`}
                                style={{ 
                                    height: isAnimated ? `${(item.value / maxValue) * 100}%` : '0%',
                                    backgroundColor: item.segments ? 'transparent' : (item.color || (multiColor ? CHART_COLORS[index % CHART_COLORS.length] : color)),
                                }}
                                onMouseOver={(e) => handleMouseOver(e, item)}
                                onMouseMove={handleMouseMove}
                            >
                                {item.segments?.map((segment, segIndex) => (
                                    <div
                                        key={segIndex}
                                        className="w-full"
                                        style={{
                                            height: item.value > 0 ? `${(segment.value / item.value) * 100}%` : '0%',
                                            backgroundColor: segment.color,
                                            transition: 'height 0.5s ease-out'
                                        }}
                                        onMouseOver={(e) => {
                                            e.stopPropagation();
                                            handleMouseOver(e, { ...item, value: segment.value, label: `${item.label} (${segment.label})` });
                                        }}
                                        onMouseMove={handleMouseMove}
                                    ></div>
                                ))}
                            </div>
                            {showValuesOnBottom && item.value > 0 && (
                                <span className="text-xs font-semibold text-secondary-600 dark:text-secondary-400 mt-1">
                                    {item.value}
                                </span>
                            )}
                            <span className="text-xs text-secondary-500 mt-1 truncate">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BarChart;
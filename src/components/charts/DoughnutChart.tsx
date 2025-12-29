import React, { useState, useEffect, useRef, type FC } from 'react';

interface ChartDataItem {
    label: string;
    value: number;
    color?: string;
}

interface DoughnutChartProps {
    title: string;
    data: ChartDataItem[];
    onClick?: (item: ChartDataItem) => void;
}

const DoughnutChart: FC<DoughnutChartProps> = ({ title, data, onClick }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number } | null>(null);
    const pathRefs = useRef<(SVGPathElement | null)[]>([]);

    useEffect(() => {
        pathRefs.current.forEach(path => {
            if (path) {
                const length = path.getTotalLength();
                path.style.strokeDasharray = `${length} ${length}`;
                path.style.strokeDashoffset = `${length}`;
                path.getBoundingClientRect(); // Trigger reflow to apply initial state
                path.style.transition = 'stroke-dashoffset 1s ease-in-out';
                path.style.strokeDashoffset = '0';
            }
        });
    }, [data]);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
        return (
             <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg h-full">
                <h2 className="text-xl font-semibold mb-2">{title}</h2>
                <div className="flex items-center justify-center h-48 text-secondary-500">
                    No data to display
                </div>
            </div>
        );
    }

    const handleMouseOver = (e: React.MouseEvent, item: ChartDataItem, percentage: string) => {
        setTooltip({
            visible: true,
            content: `${item.label}: ${item.value.toLocaleString()} (${percentage}%)`,
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

    let cumulative = 0;
    const segments = data.map(item => {
        const percentage = (item.value / total) * 100;
        const startAngle = (cumulative / total) * 360;
        cumulative += item.value;
        const endAngle = (cumulative / total) * 360;
        
        const start = polarToCartesian(50, 50, 40, endAngle);
        const end = polarToCartesian(50, 50, 40, startAngle);
        
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        
        const d = [
            "M", start.x, start.y, 
            "A", 40, 40, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");

        return {
            d,
            color: item.color || '#000',
            label: item.label,
            value: item.value,
            percentage: percentage.toFixed(1)
        };
    });
    
    function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians),
        };
    }
    
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
            <h2 className="text-xl font-semibold mb-4">{title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="relative w-48 h-48 mx-auto">
                    <svg viewBox="0 0 100 100">
                        {segments.map((segment, index) => (
                            <path
                                key={index}
                                // FIX: Changed ref callback from a concise body to a block body to ensure a void return type, resolving the TypeScript error.
                                ref={el => { pathRefs.current[index] = el; }}
                                d={segment.d}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="20"
                                onClick={() => onClick && onClick(data[index])}
                                onMouseOver={(e) => handleMouseOver(e, data[index], segment.percentage)}
                                onMouseMove={handleMouseMove}
                                className={`doughnut-segment ${onClick ? 'cursor-pointer' : ''}`}
                            />
                        ))}
                    </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                        <span className="text-sm text-secondary-500">Total</span>
                    </div>
                </div>
                <div className="space-y-2">
                    {segments.map((segment, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: segment.color }}></span>
                                <span>{segment.label}</span>
                            </div>
                            <span className="font-semibold">{segment.value.toLocaleString()} ({segment.percentage}%)</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DoughnutChart;
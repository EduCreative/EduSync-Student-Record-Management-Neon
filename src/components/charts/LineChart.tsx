import React, { useState, useEffect, useRef, type FC, type ReactNode } from 'react';

export interface LineChartData {
    label: string;
    value: number;
}

interface LineChartProps {
    title: ReactNode;
    data: LineChartData[];
    color?: string;
}

const LineChart: FC<LineChartProps> = ({ title, data, color = '#3b82f6' }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number } | null>(null);
    const pathRef = useRef<SVGPolylineElement | null>(null);

    useEffect(() => {
        if (pathRef.current) {
            const length = pathRef.current.getTotalLength();
            pathRef.current.style.strokeDasharray = `${length} ${length}`;
            pathRef.current.style.strokeDashoffset = `${length}`;
            pathRef.current.getBoundingClientRect(); // Trigger reflow to apply initial state
            pathRef.current.style.transition = 'stroke-dashoffset 1.5s ease-in-out';
            pathRef.current.style.strokeDashoffset = '0';
        }
    }, [data]);


    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg h-full">
                <div className="mb-2">{title}</div>
                <div className="flex items-center justify-center h-64 text-secondary-500">
                    No data to display
                </div>
            </div>
        );
    }

    const maxValue = Math.max(...data.map(item => item.value), 0);
    const chartHeight = 200;
    const chartWidth = 500; // ViewBox width

    const points = data.map((point, i) => {
        const x = data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2;
        const y = chartHeight - (point.value / maxValue) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    const areaPath = `M0,${chartHeight} ${points} L${data.length > 1 ? chartWidth : chartWidth / 2},${chartHeight} Z`;

    const handleMouseOver = (e: React.MouseEvent, item: LineChartData) => {
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

    return (
        <div className="bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-lg" onMouseLeave={handleMouseOut}>
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
            <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} className="min-w-[400px]">
                    <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#areaGradient)" />
                    <polyline
                        ref={pathRef}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        points={points}
                    />
                    {data.map((point, i) => {
                        const x = data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2;
                        const y = chartHeight - (point.value / maxValue) * chartHeight;
                        return (
                            <g key={i} onMouseOver={(e) => handleMouseOver(e, point)} onMouseMove={handleMouseMove}>
                                {/* Invisible larger circle for easier hover */}
                                <circle cx={x} cy={y} r="8" fill="transparent" />
                                <circle
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill={color}
                                    className="line-point"
                                />
                                {(i % 5 === 0 || data.length < 10 || i === data.length - 1) && (
                                <text
                                    x={x}
                                    y={chartHeight + 20}
                                    textAnchor="middle"
                                    fontSize="12"
                                    className="fill-current text-secondary-500 dark:text-secondary-400"
                                >
                                    {point.label}
                                </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
};

export default LineChart;
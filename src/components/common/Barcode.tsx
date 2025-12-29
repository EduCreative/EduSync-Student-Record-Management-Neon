import React from 'react';

// Code 128 character set B
const CHAR_SET = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

// Code 128 encoding patterns for character set B, start codes, and stop code
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", 
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", 
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", 
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", 
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", 
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", 
  "314111", "221411", "413111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", 
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "412111", "241112", "134111", 
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", 
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", 
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_B_CODE = 104;
const STOP_CODE_INDEX = 106;

interface BarcodeProps {
  value: string;
  height?: number;
  barWidth?: number;
}

const Barcode: React.FC<BarcodeProps> = ({ value, height = 40, barWidth = 1 }) => {
    if (!value) {
        return null;
    }

    try {
        const indices: number[] = [];
        for (const char of value) {
            const index = CHAR_SET.indexOf(char);
            if (index === -1) {
                throw new Error(`Invalid character in barcode value: ${char}`);
            }
            indices.push(index);
        }

        let checksum = START_B_CODE;
        indices.forEach((val, i) => {
            checksum += (i + 1) * val;
        });
        const checksumIndex = checksum % 103;

        const allIndices = [START_B_CODE, ...indices, checksumIndex, STOP_CODE_INDEX];
        const patterns = allIndices.map(index => PATTERNS[index]);
        const fullPattern = patterns.join('');

        const bars: { x: number; width: number }[] = [];
        let currentX = 0;

        for (let i = 0; i < fullPattern.length; i++) {
            const width = parseInt(fullPattern[i], 10) * barWidth;
            if (i % 2 === 0) { // It's a bar
                bars.push({ x: currentX, width });
            }
            currentX += width;
        }

        const totalWidth = currentX;

        return (
            <div className="barcode-container">
                <svg width={totalWidth} height={height} shapeRendering="crispEdges">
                    {bars.map((bar, i) => (
                        <rect key={i} x={bar.x} y={0} width={bar.width} height={height} fill="black" />
                    ))}
                </svg>
                <p style={{ letterSpacing: `${barWidth * 1.5}px`, fontSize: '10px', margin: '2px 0 0 0' }}>{value}</p>
            </div>
        );
    } catch (error) {
        console.error("Barcode generation failed:", error);
        return <div style={{ color: 'red', fontSize: '10px' }}>Error generating barcode.</div>;
    }
};

export default Barcode;

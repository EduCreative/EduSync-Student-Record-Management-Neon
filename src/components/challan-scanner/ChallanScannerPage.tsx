import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { FeeChallan, Student } from '../../types';
import FeePaymentModal from '../fees/FeePaymentModal';
import Avatar from '../common/Avatar';
import { useToast } from '../../context/ToastContext';

// Declare BarcodeDetector for environments where it might not be typed
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

// Icons
const CameraIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
const CameraOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 20 20"/><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><path d="M9.53 9.47a3 3 0 1 0 4.98 4.98"/></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;

const ChallanScannerPage: React.FC = () => {
    const { fees, students, classes } = useData();
    const { showToast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectorRef = useRef<BarcodeDetector | null>(null);
    const lastNotFoundToast = useRef(0);

    const [isScanning, setIsScanning] = useState(false);
    const [scannedChallan, setScannedChallan] = useState<FeeChallan | null>(null);
    const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualChallanNumber, setManualChallanNumber] = useState('');

    const feesMap = useMemo(() => new Map(fees.map(f => [f.challanNumber, f])), [fees]);
    const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
    const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);
    
    const feesMapRef = useRef(feesMap);
    feesMapRef.current = feesMap;
    const studentMapRef = useRef(studentMap);
    studentMapRef.current = studentMap;

    const resetScanner = useCallback(() => {
        setScannedChallan(null);
        setScannedStudent(null);
        setError(null);
        setManualChallanNumber('');
    }, []);
    
    const stopScan = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsScanning(false);
    }, []);

    const processChallanNumber = useCallback((challanNumber: string) => {
        const challan = feesMapRef.current.get(challanNumber);
        if (challan) {
            const student = studentMapRef.current.get(challan.studentId);
            setScannedChallan(challan);
            setScannedStudent(student || null);
            showToast('Success', `Challan #${challanNumber} found!`, 'success');
            stopScan();
            return true;
        }
        return false;
    }, [showToast, stopScan]);

    const handleManualSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualChallanNumber.trim()) return;
        
        resetScanner();
        const found = processChallanNumber(manualChallanNumber.trim());
        if (!found) {
            setError(`Challan #${manualChallanNumber.trim()} not found.`);
        }
    };

    const startScan = useCallback(async () => {
        resetScanner();
        
        if (!window.isSecureContext) {
            setError('Camera access requires a secure connection (HTTPS).');
            return;
        }

        if (!('BarcodeDetector' in window)) {
            setError('Barcode detection is not supported in this browser.');
            return;
        }

        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
                if (permissionStatus.state === 'denied') {
                    setError('Camera permission has been denied. To use the scanner, please go to your browser settings for this site and allow camera access.');
                    return;
                }
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            detectorRef.current = new BarcodeDetector({ formats: ['code_128', 'qr_code'] });
            setIsScanning(true);
        } catch (err: any) {
            let message = 'Could not access the camera. Please ensure you grant permission when prompted.';
            if (err.name === 'NotAllowedError') {
                message = 'Camera access was denied. To use the scanner, please go to your browser settings for this site and allow camera access.';
            } else if (err.name === 'NotFoundError') {
                message = 'No camera was found on your device.';
            } else if (err.name === 'NotReadableError') {
                message = 'The camera is currently in use by another application or browser tab.';
            }
            setError(message);
            console.error(err);
        }
    }, [resetScanner]);

    useEffect(() => {
        let animationFrameId: number;

        const scanLoop = async () => {
            if (videoRef.current && detectorRef.current && isScanning && !scannedChallan) {
                try {
                    const barcodes = await detectorRef.current.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        const challanNumber = barcodes[0].rawValue;
                        const found = processChallanNumber(challanNumber);

                        if (!found) {
                            const now = Date.now();
                            if (now - lastNotFoundToast.current > 3000) { // Only show toast every 3 seconds
                                showToast('Not Found', `Challan #${challanNumber} not found.`, 'info');
                                lastNotFoundToast.current = now;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Scan failed:', e);
                }
            }
            animationFrameId = requestAnimationFrame(scanLoop);
        };
        
        if(isScanning) {
            scanLoop();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
            stopScan();
        };
    }, [isScanning, stopScan, showToast, scannedChallan, processChallanNumber]);
    
    const handlePaymentModalClose = () => {
        setIsPaymentModalOpen(false);
        resetScanner(); // Reset for next scan
    };
    
    const balanceDue = scannedChallan ? scannedChallan.totalAmount - scannedChallan.discount - scannedChallan.paidAmount : 0;


    return (
        <>
            {scannedChallan && scannedStudent && (
                <FeePaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={handlePaymentModalClose}
                    challan={scannedChallan}
                    student={scannedStudent}
                />
            )}
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Scan & Pay Challan</h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg shadow-md flex flex-col items-center">
                        <div className="w-full aspect-video bg-black rounded-md overflow-hidden relative flex items-center justify-center">
                            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isScanning ? 'hidden' : ''}`}></video>
                            {!isScanning && <div className="text-secondary-400 flex flex-col items-center gap-2"><CameraOffIcon /><span className="text-sm">Camera is off</span></div>}
                            {isScanning && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 max-w-sm h-1/4 border-2 border-dashed border-white/50 rounded-lg"></div>}
                        </div>
                        <button onClick={isScanning ? stopScan : startScan} className={`btn ${isScanning ? 'btn-danger' : 'btn-primary'} mt-4`}>
                            {isScanning ? <CameraOffIcon /> : <CameraIcon />}
                            {isScanning ? 'Stop Scanning' : 'Start Camera'}
                        </button>
                        
                        <div className="w-full mt-4 pt-4 border-t dark:border-secondary-700">
                             <form onSubmit={handleManualSearch} className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualChallanNumber}
                                    onChange={(e) => setManualChallanNumber(e.target.value)}
                                    className="input-field"
                                    placeholder="Or enter challan number manually"
                                    disabled={isScanning}
                                />
                                <button type="submit" className="btn-secondary" disabled={isScanning}><SearchIcon /></button>
                            </form>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-secondary-700">Scanned Details</h2>
                        {error && <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 p-4 rounded-md text-center">{error}</div>}
                        {!error && scannedChallan && scannedStudent ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Avatar student={scannedStudent} className="w-16 h-16"/>
                                    <div>
                                        <p className="font-bold text-lg">{scannedStudent.name}</p>
                                        <p className="text-sm text-secondary-500">{classMap.get(scannedStudent.classId)} - <span className="font-bold text-primary-700 dark:text-primary-400">ID: {scannedStudent.rollNumber}</span></p>
                                        <p className="text-xs text-secondary-400">Challan: {scannedChallan.challanNumber}</p>
                                    </div>
                                </div>

                                <div className="bg-secondary-50 dark:bg-secondary-700/50 p-3 rounded-md text-sm">
                                    <div className="flex justify-between mb-1">
                                        <span>Total Amount:</span>
                                        <span className="font-bold">Rs. {scannedChallan.totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                        <span>Paid Amount:</span>
                                        <span className="font-bold text-green-600 dark:text-green-400">Rs. {scannedChallan.paidAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t dark:border-secondary-600">
                                        <span>Balance Due:</span>
                                        <span className={`font-bold ${balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            Rs. {balanceDue.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <button onClick={() => setIsPaymentModalOpen(true)} className="btn-primary w-full mt-2">
                                    Record Payment
                                </button>
                            </div>
                        ) : (
                            !error && <p className="text-center text-secondary-500 py-8">Scan a QR code or barcode to view details.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ChallanScannerPage;
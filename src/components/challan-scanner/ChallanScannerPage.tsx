
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
            setError('Native barcode detection is not supported in this browser. Please use Google Chrome on Android or a very recent iOS version.');
            return;
        }

        try {
            const constraints = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Force play to ensure mobile browsers initialize the stream
                try {
                    await videoRef.current.play();
                } catch (playErr) {
                    console.warn("Video auto-play failed, waiting for user interaction or metadata.", playErr);
                }
            }
            
            detectorRef.current = new BarcodeDetector({ formats: ['code_128', 'qr_code'] });
            setIsScanning(true);
        } catch (err: any) {
            let message = 'Could not access the camera.';
            if (err.name === 'NotAllowedError') {
                message = 'Camera permission denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                message = 'No rear camera found on this device.';
            }
            setError(message);
            console.error("Scanner Error:", err);
        }
    }, [resetScanner]);

    useEffect(() => {
        let animationFrameId: number;

        const scanLoop = async () => {
            if (videoRef.current && detectorRef.current && isScanning && !scannedChallan) {
                // Only scan if video is actually playing and producing frames
                if (videoRef.current.readyState >= 2 && !videoRef.current.paused) {
                    try {
                        const barcodes = await detectorRef.current.detect(videoRef.current);
                        if (barcodes.length > 0) {
                            const challanNumber = barcodes[0].rawValue;
                            processChallanNumber(challanNumber);
                        }
                    } catch (e) {
                        // Silent fail for individual frames
                    }
                }
            }
            animationFrameId = requestAnimationFrame(scanLoop);
        };
        
        if(isScanning) {
            scanLoop();
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isScanning, scannedChallan, processChallanNumber]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => stopScan();
    }, [stopScan]);

    const handlePaymentModalClose = () => {
        setIsPaymentModalOpen(false);
        resetScanner(); 
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
                            {/* Keep video in DOM to avoid initialization issues on mobile */}
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className={`w-full h-full object-cover ${!isScanning ? 'opacity-0 h-0 w-0' : 'opacity-100'}`}
                            ></video>
                            
                            {!isScanning && (
                                <div className="text-secondary-400 flex flex-col items-center gap-2">
                                    <CameraOffIcon />
                                    <span className="text-sm">Camera is inactive</span>
                                </div>
                            )}
                            
                            {isScanning && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                    <div className="w-4/5 h-1/3 border-2 border-dashed border-neon-glow/60 rounded-lg shadow-[0_0_15px_rgba(0,243,255,0.3)] animate-pulse"></div>
                                    <div className="mt-4 text-[10px] uppercase font-bold text-white bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Align Barcode or QR inside box</div>
                                </div>
                            )}
                        </div>
                        
                        <button 
                            onClick={isScanning ? stopScan : startScan} 
                            className={`btn ${isScanning ? 'btn-danger' : 'btn-primary'} mt-4 w-full sm:w-auto px-8 py-3`}
                        >
                            {isScanning ? <CameraOffIcon /> : <CameraIcon />}
                            {isScanning ? 'Stop Camera' : 'Open Scanner'}
                        </button>
                        
                        <div className="w-full mt-4 pt-4 border-t dark:border-secondary-700">
                             <form onSubmit={handleManualSearch} className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualChallanNumber}
                                    onChange={(e) => setManualChallanNumber(e.target.value)}
                                    className="input-field"
                                    placeholder="Enter Challan # manually"
                                    disabled={isScanning}
                                />
                                <button type="submit" className="btn-secondary" disabled={isScanning}><SearchIcon /></button>
                            </form>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg shadow-md border-t-4 border-primary-500">
                        <h2 className="text-xl font-bold mb-4 border-b pb-2 dark:border-secondary-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                            Live Results
                        </h2>
                        
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm text-center">
                                <p className="font-bold mb-1">Initialization Failed</p>
                                {error}
                            </div>
                        )}
                        
                        {!error && scannedChallan && scannedStudent ? (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex items-center gap-4 p-3 bg-secondary-50 dark:bg-secondary-900/50 rounded-lg">
                                    <Avatar student={scannedStudent} className="w-16 h-16 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-secondary-800"/>
                                    <div>
                                        <p className="font-bold text-lg text-secondary-900 dark:text-white leading-tight">{scannedStudent.name}</p>
                                        <p className="text-sm text-secondary-500">{classMap.get(scannedStudent.classId)} | <span className="font-bold text-primary-700 dark:text-primary-400">ID: {scannedStudent.rollNumber}</span></p>
                                        <p className="text-[10px] uppercase font-bold text-secondary-400 mt-1">Challan: {scannedChallan.challanNumber}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-secondary-500">Total Amount:</span>
                                        <span className="font-semibold">Rs. {scannedChallan.totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-secondary-500">Paid Amount:</span>
                                        <span className="font-bold text-green-600 dark:text-green-400">Rs. {scannedChallan.paidAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t dark:border-secondary-700 text-base">
                                        <span className="font-bold">Balance Due:</span>
                                        <span className={`font-black ${balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            Rs. {balanceDue.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setIsPaymentModalOpen(true)} 
                                    className="btn-primary w-full mt-2 py-3 font-bold text-lg shadow-neon-glow/20"
                                >
                                    Record Payment Now
                                </button>
                            </div>
                        ) : (
                            !error && (
                                <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                                    <div className="w-16 h-16 border-4 border-dashed border-secondary-300 dark:border-secondary-600 rounded-full mb-4 animate-spin-slow"></div>
                                    <p className="text-secondary-500 font-medium">Waiting for valid barcode scan...</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .animate-spin-slow { animation: spin 8s linear infinite; }
            `}</style>
        </>
    );
};

export default ChallanScannerPage;

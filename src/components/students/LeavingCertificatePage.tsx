import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { usePrint } from '../../context/PrintContext';
import { ActiveView } from '../layout/Layout';
import { Student } from '../../types';
import { useToast } from '../../context/ToastContext';
import PrintableLeavingCertificate from '../reports/PrintableLeavingCertificate';

interface LeavingCertificatePageProps {
    studentId: string;
    setActiveView: (view: ActiveView) => void;
}

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const LeavingCertificatePage: React.FC<LeavingCertificatePageProps> = ({ studentId, setActiveView }) => {
    const { students, classes, getSchoolById, issueLeavingCertificate } = useData();
    const { showPrintPreview } = usePrint();
    const { showToast } = useToast();

    const student = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);
    const school = useMemo(() => getSchoolById(student?.schoolId || ''), [getSchoolById, student]);

    const [details, setDetails] = useState({
        dateOfLeaving: getTodayString(),
        reasonForLeaving: '',
        conduct: 'Good', // Initialized as string to satisfy PrintableLeavingCertificate prop types
        progress: 'Satisfactory',
        placeOfBirth: '',
    });
    
    const [isIssuing, setIsIssuing] = useState(false);

    // Pre-fill data if student has already left
    useEffect(() => {
        if (student) {
            setDetails(prev => ({
                ...prev,
                dateOfLeaving: student.dateOfLeaving || prev.dateOfLeaving,
                reasonForLeaving: student.reasonForLeaving || prev.reasonForLeaving,
                conduct: (student.conduct || prev.conduct) as string,
                progress: student.progress || prev.progress,
                placeOfBirth: student.placeOfBirth || prev.placeOfBirth
            }));
        }
    }, [student]);

    if (!student || !school) return <div>Loading...</div>;
    
    const studentClass = classes.find(c => c.id === student.classId);
    const isReprint = student.status === 'Left';

    const handleIssueAndPrint = async () => {
        if (!details.reasonForLeaving.trim()) {
            showToast('Missing Information', 'Please specify a reason for leaving.', 'error');
            return;
        }

        setIsIssuing(true);
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out.")), 15000)
            );

            // Even if reprinting, we update the record to save any changes made in the form
            await Promise.race([
                issueLeavingCertificate(student.id, {
                    ...details,
                    conduct: details.conduct as Student['conduct'] // Cast string back to specific type for DB
                }),
                timeoutPromise
            ]);
            
            const content = (
                <PrintableLeavingCertificate 
                    student={student}
                    school={school}
                    studentClass={studentClass?.name || 'N/A'}
                    details={details}
                />
            );
            
            showPrintPreview(content, `Leaving Certificate - ${student.name}`);
        } catch (error: any) {
            console.error("Error issuing certificate:", error);
            showToast('Error', error.message || 'Failed to issue certificate.', 'error');
        } finally {
            setIsIssuing(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
             <button onClick={() => setActiveView({ view: 'studentProfile', payload: { studentId } })} className="flex items-center text-sm font-medium text-secondary-600 hover:text-primary-600 dark:text-secondary-400">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Profile
            </button>

            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
                            {isReprint ? 'Reprint Leaving Certificate' : 'Issue Leaving Certificate'}
                        </h1>
                        <p className="text-sm text-secondary-500">
                            For: <span className="font-bold text-primary-700 dark:text-primary-400">{student.name} (ID: {student.rollNumber})</span>
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="dateOfLeaving" className="input-label">Date of Leaving</label>
                            <input type="date" id="dateOfLeaving" value={details.dateOfLeaving} onChange={e => setDetails(d => ({...d, dateOfLeaving: e.target.value}))} className="input-field" />
                        </div>
                         <div>
                            <label htmlFor="placeOfBirth" className="input-label">Place of Birth</label>
                            <input type="text" id="placeOfBirth" value={details.placeOfBirth} onChange={e => setDetails(d => ({...d, placeOfBirth: e.target.value}))} className="input-field" placeholder="City, Country" />
                        </div>
                         <div className="md:col-span-2">
                            <label htmlFor="reasonForLeaving" className="input-label">Reason for Leaving</label>
                            <input type="text" id="reasonForLeaving" value={details.reasonForLeaving} onChange={e => setDetails(d => ({...d, reasonForLeaving: e.target.value}))} className="input-field" placeholder="e.g., Relocation, Completed Studies" />
                        </div>
                         <div>
                            <label htmlFor="conduct" className="input-label">Conduct</label>
                            <select id="conduct" value={details.conduct} onChange={e => setDetails(d => ({...d, conduct: e.target.value}))} className="input-field">
                                <option>Excellent</option>
                                <option>Good</option>
                                <option>Fair</option>
                                <option>Poor</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="progress" className="input-label">Academic Progress</label>
                            <input type="text" id="progress" value={details.progress} onChange={e => setDetails(d => ({...d, progress: e.target.value}))} className="input-field" placeholder="e.g. Satisfactory, Excellent" />
                        </div>
                    </div>
                    
                    {!isReprint && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-md text-sm text-yellow-800 dark:text-yellow-200 mt-4">
                            <p><strong>Note:</strong> Issuing this certificate will update the student's status to <strong>"Left"</strong>.</p>
                        </div>
                    )}

                    <div className="pt-4">
                        <button onClick={handleIssueAndPrint} className="btn-primary w-full flex justify-center items-center gap-2" disabled={isIssuing}>
                            {isIssuing ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {isReprint ? 'Updating & Printing...' : 'Issuing...'}
                                </>
                            ) : (
                                isReprint ? 'Update & Reprint Certificate' : 'Issue & Print Certificate'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>;

export default LeavingCertificatePage;
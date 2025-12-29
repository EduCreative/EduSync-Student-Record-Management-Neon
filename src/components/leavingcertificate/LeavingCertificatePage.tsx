import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { usePrint } from '../../context/PrintContext';
import { formatDate, EduSyncLogo } from '../../constants';
import { ActiveView } from '../layout/Layout';
import { Student } from '../../types';

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

    const student = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);
    const school = useMemo(() => getSchoolById(student?.schoolId || ''), [getSchoolById, student]);

    const [details, setDetails] = useState({
        dateOfLeaving: getTodayString(),
        reasonForLeaving: '',
        conduct: 'Good' as Student['conduct'],
    });

    if (!student || !school) return <div>Loading...</div>;
    
    const studentClass = classes.find(c => c.id === student.classId);

    const handleIssueAndPrint = async () => {
        await issueLeavingCertificate(student.id, details);
        
        const certificateContent = (
            <div className="leaving-certificate-page font-serif text-black p-12 flex flex-col items-center justify-between bg-white"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%23333' stroke-width='8' stroke-dasharray='16%2c 16' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`}}>
                 
                <div className="flex w-full items-center gap-4">
                    <div className="flex-shrink-0 h-20 w-20 flex items-center justify-center">
                        {school.logoUrl ? (
                            <img src={school.logoUrl} alt="School Logo" className="max-h-20 max-w-20 object-contain"/>
                        ) : (
                            <EduSyncLogo className="h-20 text-primary-700" />
                        )}
                    </div>
                    <div className="text-left">
                        <h1 className="text-4xl font-bold tracking-wider">{school.name}</h1>
                        <p className="text-lg">{school.address}</p>
                    </div>
                </div>
                
                <h2 className="text-3xl font-semibold mt-10 border-b-2 border-black pb-2 inline-block">SCHOOL LEAVING CERTIFICATE</h2>
                
                <div className="w-full text-lg mt-8 space-y-4 px-8 text-left">
                    <p>This is to certify that <strong className="border-b border-dotted border-black px-2">{student.name}</strong> son/daughter of <strong className="border-b border-dotted border-black px-2">{student.fatherName}</strong>, a student of class <strong className="border-b border-dotted border-black px-2">{studentClass?.name || 'N/A'}</strong> has been on the rolls of this school from <strong className="border-b border-dotted border-black px-2">{formatDate(student.dateOfAdmission)}</strong> to <strong className="border-b border-dotted border-black px-2">{formatDate(details.dateOfLeaving)}</strong>.</p>
                    <p>According to the school records, their date of birth is <strong className="border-b border-dotted border-black px-2">{formatDate(student.dateOfBirth)}</strong>.</p>
                    <p>They are leaving this institution for the following reason: <strong className="border-b border-dotted border-black px-2">{details.reasonForLeaving}</strong>.</p>
                    <p>Their conduct during their stay at the school was <strong className="border-b border-dotted border-black px-2">{details.conduct}</strong>.</p>
                    <p>We wish them all the best for their future endeavors.</p>
                </div>

                <div className="w-full flex justify-between items-end mt-20 pt-8">
                    <div className="text-center">
                        <p>Date: {formatDate(new Date())}</p>
                    </div>
                    <div className="text-center">
                        <p className="border-t-2 border-black pt-2 px-8 font-semibold">Principal's Signature</p>
                    </div>
                </div>
            </div>
        );
        showPrintPreview(certificateContent, `EduSync - Leaving Certificate - ${student.name}`);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
             <button onClick={() => setActiveView({ view: 'studentProfile', payload: { studentId } })} className="flex items-center text-sm font-medium text-secondary-600 hover:text-primary-600 dark:text-secondary-400">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Profile
            </button>

            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold mb-4">Issue Leaving Certificate for {student.name}</h1>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="dateOfLeaving" className="input-label">Date of Leaving</label>
                        <input type="date" id="dateOfLeaving" value={details.dateOfLeaving} onChange={e => setDetails(d => ({...d, dateOfLeaving: e.target.value}))} className="input-field" />
                    </div>
                     <div>
                        <label htmlFor="reasonForLeaving" className="input-label">Reason for Leaving</label>
                        <input type="text" id="reasonForLeaving" value={details.reasonForLeaving} onChange={e => setDetails(d => ({...d, reasonForLeaving: e.target.value}))} className="input-field" placeholder="e.g., Relocation" />
                    </div>
                     <div>
                        <label htmlFor="conduct" className="input-label">Conduct</label>
                        <select id="conduct" value={details.conduct} onChange={e => setDetails(d => ({...d, conduct: e.target.value as Student['conduct']}))} className="input-field">
                            <option>Excellent</option>
                            <option>Good</option>
                            <option>Fair</option>
                            <option>Poor</option>
                        </select>
                    </div>
                    <div className="pt-4">
                        <button onClick={handleIssueAndPrint} className="btn-primary w-full">
                            Issue & Print Certificate
                        </button>
                    </div>
                </div>
            </div>
             <style>{`
                .input-label { @apply block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1; }
                .input-field { @apply w-full p-2 border rounded-md bg-secondary-50 text-secondary-900 dark:bg-secondary-700 dark:border-secondary-600 dark:text-secondary-200 placeholder:text-secondary-400 dark:placeholder:text-secondary-500; }
                .btn-primary { @apply px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg; }
            `}</style>
        </div>
    );
};

const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>;


export default LeavingCertificatePage;
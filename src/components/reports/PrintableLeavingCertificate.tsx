

import React from 'react';
import { Student, School } from '../../types';
import { formatDate, EduSyncLogo } from '../../constants';

interface PrintableLeavingCertificateProps {
    student: Student;
    school: School;
    studentClass: string;
    details: {
        dateOfLeaving: string;
        reasonForLeaving: string;
        conduct: string;
        progress: string;
        placeOfBirth: string;
    };
}

const FieldRow: React.FC<{ label: string; value: string | number | undefined; width?: string }> = ({ label, value, width = 'w-full' }) => (
    <div className={`flex items-baseline text-[10px] mb-1 ${width}`}>
        <span className="font-semibold whitespace-nowrap mr-1">{label}:</span>
        <span className="border-b border-dotted border-black flex-1 px-1 leading-none">{value || '-'}</span>
    </div>
);

const CertificateCopy: React.FC<{
    title: string;
    student: Student;
    school: School;
    studentClass: string;
    details: PrintableLeavingCertificateProps['details'];
}> = ({ title, student, school, studentClass, details }) => (
    <div className="h-full flex flex-col p-4 border-2 border-gray-800 bg-white relative">
        {/* Header */}
        <div className="flex items-start gap-2 border-b-2 border-gray-800 pb-2 mb-2">
            <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center">
                {school.logoUrl ? (
                    <img src={school.logoUrl} alt="logo" className="max-h-10 max-w-10 object-contain" />
                ) : (
                    <EduSyncLogo className="h-8 text-primary-700" />
                )}
            </div>
            <div className="flex-1 text-center">
                <h3 className="font-bold text-sm uppercase leading-tight">{school.name}</h3>
                <p className="text-[8px] leading-tight">{school.address}</p>
                <div className="mt-1">
                    <span className="text-[9px] font-bold bg-black text-white px-2 py-0.5 rounded-sm uppercase tracking-widest">
                        Leaving Certificate - {title}
                    </span>
                </div>
            </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-x-2">
                <FieldRow label="GR No" value={student.grNumber} />
                <FieldRow label="Student ID" value={student.rollNumber} />
                
                <div className="col-span-2">
                    <FieldRow label="Name" value={student.name} />
                </div>
                <div className="col-span-2">
                    <FieldRow label="Father's Name" value={student.fatherName} />
                </div>

                <FieldRow label="Gender" value={student.gender} />
                <FieldRow label="Caste" value={student.caste} />

                <div className="col-span-2">
                    <FieldRow label="Religion" value={student.religion} />
                </div>

                <div className="col-span-2 flex gap-2">
                    <FieldRow label="DOB" value={formatDate(student.dateOfBirth)} width="w-1/2" />
                    <FieldRow label="Place" value={details.placeOfBirth} width="w-1/2" />
                </div>

                <FieldRow label="Admitted" value={formatDate(student.dateOfAdmission)} />
                <FieldRow label="Adm. Class" value={student.admittedClass} />

                <div className="col-span-2">
                    <FieldRow label="Last School" value={student.lastSchoolAttended} />
                </div>
                
                <div className="col-span-2 flex gap-2">
                    <FieldRow label="Leaving" value={formatDate(details.dateOfLeaving)} width="w-1/2" />
                     <FieldRow label="Current Class" value={studentClass} width="w-1/2" />
                </div>

                <div className="col-span-2">
                    <FieldRow label="Reason" value={details.reasonForLeaving} />
                </div>
                
                <div className="col-span-2 flex gap-2">
                     <FieldRow label="Conduct" value={details.conduct} width="w-1/2" />
                     <FieldRow label="Progress" value={details.progress} width="w-1/2" />
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-between items-end text-[9px]">
                 <div className="text-center">
                    <p>{formatDate(new Date())}</p>
                    <p className="font-bold border-t border-black pt-0.5 px-2">Issue Date</p>
                </div>
                <div className="text-center">
                     <p className="h-4"></p>
                    <p className="font-bold border-t border-black pt-0.5 px-2">Principal Signature</p>
                </div>
            </div>
        </div>
    </div>
);

const PrintableLeavingCertificate: React.FC<PrintableLeavingCertificateProps> = (props) => {
    return (
        <div className="leaving-certificate-container w-full h-full flex flex-row bg-white text-black">
            {/* School Copy - 30% */}
            <div style={{ width: '30%' }} className="h-full border-r-2 border-dashed border-gray-400 pr-1">
                <CertificateCopy title="School Copy" {...props} />
            </div>
            
            {/* Parent Copy - 70% */}
            <div style={{ width: '70%' }} className="h-full pl-1">
                 <CertificateCopy title="Parent Copy" {...props} />
            </div>
        </div>
    );
};

export default PrintableLeavingCertificate;
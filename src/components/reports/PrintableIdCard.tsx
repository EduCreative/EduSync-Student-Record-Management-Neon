
import type { FC } from 'react';
import { Student, School } from '../../types';
import Avatar from '../common/Avatar';

interface PrintableIdCardProps {
    student: Student;
    school: School;
    studentClass?: string;
}

const PrintableIdCard: FC<PrintableIdCardProps> = ({ student, school, studentClass }) => {
    return (
        <div className="id-card">
            <div className="id-card-header">
                {school.logoUrl ? (
                    <img src={school.logoUrl} alt="School Logo" className="id-card-logo" />
                ) : (
                    <div className="id-card-logo-placeholder"></div>
                )}
                <div>
                    <h1 className="id-card-school-name">{school.name}</h1>
                    <p className="id-card-school-address">{school.address}</p>
                </div>
            </div>
            <div className="id-card-body">
                <div className="id-card-photo-container">
                    <Avatar student={student} className="id-card-photo" />
                </div>
                <div className="id-card-info">
                    <h2 className="id-card-student-name">{student.name}</h2>
                    <p><strong>Father's Name:</strong> {student.fatherName}</p>
                    <p><strong>Class:</strong> {studentClass || 'N/A'}</p>
                    <p><strong>Student ID:</strong> <span className="font-bold text-lg">{student.rollNumber}</span></p>
                    <p><strong>Contact:</strong> {student.contactNumber}</p>
                </div>
            </div>
            <div className="id-card-footer">
                STUDENT IDENTITY CARD
            </div>
        </div>
    );
};

export default PrintableIdCard;

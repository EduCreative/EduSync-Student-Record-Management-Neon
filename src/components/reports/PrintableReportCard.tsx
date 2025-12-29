
import type { FC } from 'react';
import { Student, School, Result } from '../../types';
import { formatDate, EduSyncLogo } from '../../constants';

interface PrintableReportCardProps {
    student: Student;
    studentClass?: string;
    results: Result[];
    exam: string;
    school: School;
}

const PrintableReportCard: FC<PrintableReportCardProps> = ({ student, studentClass, results, exam, school }) => {
    
    const getTotalMarks = () => results.reduce((sum, r) => sum + r.marks, 0);
    const getTotalMaxMarks = () => results.reduce((sum, r) => sum + r.totalMarks, 0);
    
    const totalMarks = getTotalMarks();
    const totalMaxMarks = getTotalMaxMarks();
    const percentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

    const getGrade = (p: number) => {
        if (p >= 90) return 'A1+';
        if (p >= 80) return 'A1';
        if (p >= 70) return 'A';
        if (p >= 60) return 'B';
        if (p >= 50) return 'C';
        if (p >= 40) return 'D';
        return 'F';
    };

    return (
        <div className="printable-result-card bg-white p-6 border rounded-lg shadow-lg mb-8" style={{ pageBreakAfter: 'always' }}>
            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b">
                <div className="flex-shrink-0 h-16 w-16 flex items-center justify-center">
                    {school.logoUrl ? (
                        <img src={school.logoUrl} alt="School Logo" className="max-h-16 max-w-16 object-contain" />
                    ) : (
                        <EduSyncLogo className="h-12 w-12 text-primary-700" />
                    )}
                </div>
                <div className="text-left">
                    <h1 className="text-2xl font-bold">{school.name}</h1>
                    <p className="text-sm">{school.address}</p>
                </div>
            </div>
            
            <h2 className="text-xl font-semibold text-center my-4 uppercase tracking-wider">{exam} - Progress Report</h2>

            {/* Student Info */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4 p-2 border rounded">
                <div><strong>Student:</strong> {student.name}</div>
                <div><strong>Class:</strong> {studentClass}</div>
                <div><strong>Father's Name:</strong> {student.fatherName}</div>
                <div><strong>Student ID:</strong> <span className="font-bold text-base">{student.rollNumber}</span></div>
            </div>

            {/* Results Table */}
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-secondary-100">
                        <th className="p-2 border text-left">Subject</th>
                        <th className="p-2 border">Total Marks</th>
                        <th className="p-2 border">Marks Obtained</th>
                        <th className="p-2 border">Percentage</th>
                        <th className="p-2 border">Grade</th>
                        <th className="p-2 border">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map(r => {
                        const subjectPercentage = r.totalMarks > 0 ? (r.marks / r.totalMarks) * 100 : 0;
                        return (
                            <tr key={r.id}>
                                <td className="p-2 border">{r.subject}</td>
                                <td className="p-2 border text-center">{r.totalMarks}</td>
                                <td className="p-2 border text-center">{r.marks}</td>
                                <td className="p-2 border text-center">{subjectPercentage.toFixed(1)}%</td>
                                <td className="p-2 border text-center">{getGrade(subjectPercentage)}</td>
                                <td className="p-2 border"></td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="font-bold bg-secondary-100">
                        <td className="p-2 border text-right">Total</td>
                        <td className="p-2 border text-center">{totalMaxMarks}</td>
                        <td className="p-2 border text-center">{totalMarks}</td>
                        <td className="p-2 border text-center">{percentage.toFixed(2)}%</td>
                        <td className="p-2 border text-center"></td>
                        <td className="p-2 border text-center"></td>
                    </tr>
                </tfoot>
            </table>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                <div className="p-2 border rounded">
                    <div className="text-xs font-bold">PERCENTAGE</div>
                    <div className="text-lg">{percentage.toFixed(2)}%</div>
                </div>
                <div className="p-2 border rounded">
                    <div className="text-xs font-bold">OVERALL GRADE</div>
                    <div className="text-lg">{getGrade(percentage)}</div>
                </div>
                 <div className="p-2 border rounded">
                    <div className="text-xs font-bold">STATUS</div>
                    <div className={`text-lg font-bold ${getGrade(percentage) === 'F' ? 'text-red-600' : 'text-green-600'}`}>
                        {getGrade(percentage) === 'F' ? 'FAIL' : 'PASS'}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end mt-12 pt-8">
                 <div className="text-center text-xs">
                    <p className="border-t-2 pt-2 px-8 font-semibold">Parent's Signature</p>
                </div>
                <div className="text-center text-xs">
                    <p>Date: {formatDate(new Date())}</p>
                </div>
                <div className="text-center text-xs">
                    <p className="border-t-2 pt-2 px-8 font-semibold">Principal's Signature</p>
                </div>
            </div>
        </div>
    );
};

export default PrintableReportCard;
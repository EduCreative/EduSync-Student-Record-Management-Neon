
import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Result } from '../../types';

interface StudentResultsProps {
    studentId: string;
}

const StudentResults: React.FC<StudentResultsProps> = ({ studentId }) => {
    const { results } = useData();

    // FIX: Explicitly type `groupedResults` as `Record<string, Result[]>` to correct type inference issues with `Object.entries`.
    const groupedResults: Record<string, Result[]> = useMemo(() => {
        if (!results) {
            return {};
        }
        // FIX: Re-implemented grouping logic using reduce with a properly typed initial accumulator to ensure correct type inference.
        return results
            .filter((r: Result) => r.studentId === studentId)
            .reduce((acc: Record<string, Result[]>, result: Result) => {
                const exam = result.exam;
                if (!acc[exam]) {
                    acc[exam] = [];
                }
                acc[exam].push(result);
                return acc;
            }, {} as Record<string, Result[]>);
    }, [results, studentId]);

    const getGrade = (marks: number, totalMarks: number) => {
        if (totalMarks === 0) return '-';
        const percentage = (marks / totalMarks) * 100;
        if (percentage >= 90) return 'A1+';
        if (percentage >= 80) return 'A1';
        if (percentage >= 70) return 'A';
        if (percentage >= 60) return 'B';
        if (percentage >= 50) return 'C';
        if (percentage >= 40) return 'D';
        return 'F';
    };

    return (
        <div className="space-y-8">
            <h3 className="text-lg font-medium text-secondary-900 dark:text-white">Academic Results</h3>
            {Object.entries(groupedResults).length > 0 ? (
                Object.entries(groupedResults).map(([exam, examResults]) => {
                    const totalMarks = examResults.reduce((sum, r) => sum + r.marks, 0);
                    const totalMaxMarks = examResults.reduce((sum, r) => sum + r.totalMarks, 0);
                    const percentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

                    return (
                        <div key={exam} className="border dark:border-secondary-700 rounded-lg overflow-hidden">
                            <h4 className="text-md font-semibold p-4 bg-secondary-50 dark:bg-secondary-700/50">{exam}</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-secondary-700 uppercase dark:text-secondary-400">
                                        <tr>
                                            <th className="px-4 py-2">Subject</th>
                                            <th className="px-4 py-2 text-center">Marks Obtained</th>
                                            <th className="px-4 py-2 text-center">Total Marks</th>
                                            <th className="px-4 py-2 text-center">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-secondary-700">
                                        {examResults.map(result => (
                                            <tr key={result.id}>
                                                <td className="px-4 py-3 font-medium">{result.subject}</td>
                                                <td className="px-4 py-3 text-center">{result.marks}</td>
                                                <td className="px-4 py-3 text-center">{result.totalMarks}</td>
                                                <td className="px-4 py-3 text-center font-bold">{getGrade(result.marks, result.totalMarks)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-bold bg-secondary-50 dark:bg-secondary-700/50">
                                            <td className="px-4 py-3 text-right">Total</td>
                                            <td className="px-4 py-3 text-center">{totalMaxMarks}</td>
                                            <td className="px-4 py-3 text-center">{totalMarks}</td>
                                            <td className="px-4 py-3 text-center"></td>
                                        </tr>
                                        <tr className="font-bold bg-secondary-100 dark:bg-secondary-700">
                                            <td className="px-4 py-3 text-right" colSpan={2}>Percentage</td>
                                            <td className="px-4 py-3 text-center" colSpan={2}>{percentage.toFixed(2)}%</td>
                                        </tr>
                                        <tr className="font-bold bg-secondary-100 dark:bg-secondary-700">
                                            <td className="px-4 py-3 text-right" colSpan={2}>Overall Grade</td>
                                            <td className="px-4 py-3 text-center" colSpan={2}>{getGrade(totalMarks, totalMaxMarks)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="text-center p-8 text-secondary-500">
                    <p>No results have been published for this student yet.</p>
                </div>
            )}
        </div>
    );
};

export default StudentResults;

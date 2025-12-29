
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
// FIX: Import UserRole to resolve 'Cannot find name' error.
import { Student, Result, UserRole } from '../../types';

const ResultsViewer: React.FC = () => {
    const { user } = useAuth();
    const { students, results } = useData();

    const myChildren = useMemo(() => {
        if (!user) return [];
        if (user.role === UserRole.Student) {
            const studentProfile = students.find((s: Student) => s.userId === user.id);
            return studentProfile ? [studentProfile] : [];
        }
        if (user.role === UserRole.Parent && user.childStudentIds) {
            return students.filter((s: Student) => user.childStudentIds!.includes(s.id));
        }
        return [];
    }, [user, students]);

    const [selectedChildId, setSelectedChildId] = useState<string>(myChildren[0]?.id || '');

    // FIX: Explicitly type `groupedResults` as `Record<string, Result[]>` to correct type inference issues with `Object.entries`.
    const groupedResults: Record<string, Result[]> = useMemo(() => {
        if (!selectedChildId || !results) {
            return {};
        }
        // FIX: Grouped results by exam using reduce with a properly typed initial accumulator to resolve type errors.
        return results
            .filter((r: Result) => r.studentId === selectedChildId)
            .reduce((acc: Record<string, Result[]>, result: Result) => {
                const exam = result.exam;
                if (!acc[exam]) {
                    acc[exam] = [];
                }
                acc[exam].push(result);
                return acc;
            }, {} as Record<string, Result[]>);
    }, [results, selectedChildId]);
    
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

    if(myChildren.length === 0) {
        return (
            <div className="p-8 text-center bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                <h1 className="text-xl font-semibold">No Student Linked</h1>
                <p className="text-secondary-500 mt-2">Your account is not linked to a student profile to view results.</p>
            </div>
        )
    }
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">My Results</h1>
            
            {myChildren.length > 1 && (
                <div className="max-w-xs">
                    <label htmlFor="child-select" className="input-label">Viewing Results For</label>
                    <select id="child-select" value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)} className="input-field">
                        {myChildren.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
                    </select>
                </div>
            )}
            
            <div className="space-y-8">
                {Object.entries(groupedResults).length > 0 ? (
                    Object.entries(groupedResults).map(([exam, examResults]) => (
                        <div key={exam} className="bg-white dark:bg-secondary-800 rounded-lg shadow-md overflow-hidden">
                            <h2 className="text-xl font-semibold p-4 bg-secondary-50 dark:bg-secondary-700/50">{exam}</h2>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-secondary-700 uppercase dark:text-secondary-300">
                                        <tr>
                                            <th className="px-6 py-3 text-left">Subject</th>
                                            <th className="px-6 py-3 text-center">Marks Obtained</th>
                                            <th className="px-6 py-3 text-center">Total Marks</th>
                                            <th className="px-6 py-3 text-center">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-secondary-700">
                                        {examResults.map(result => (
                                            <tr key={result.id}>
                                                <td className="px-6 py-4 font-medium">{result.subject}</td>
                                                <td className="px-6 py-4 text-center">{result.marks}</td>
                                                <td className="px-6 py-4 text-center">{result.totalMarks}</td>
                                                <td className="px-6 py-4 text-center font-bold">{getGrade(result.marks, result.totalMarks)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                        <p>No results have been published for the selected student yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsViewer;

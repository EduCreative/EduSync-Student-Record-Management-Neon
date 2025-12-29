
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
// FIX: Added Class and Student to imports for explicit typing.
import { UserRole, Result, Class, Student, Subject, Exam } from '../../types';
import Avatar from '../common/Avatar';
import ResultsViewer from './ResultsViewer';
import Modal from '../common/Modal';
import SubjectFormModal from '../subjects/SubjectFormModal';
import ExamFormModal from '../exams/ExamFormModal';
import ReportCardModal from '../reports/ReportCardModal';
import { PrinterIcon } from '../../constants';
import { getClassLevel } from '../../utils/sorting';

const CogIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l.43-.25a2 2 0 0 1 1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);

const ResultsEntry: React.FC = () => {
    const { user, effectiveRole, activeSchoolId } = useAuth();
    const { classes, students, results, subjects, exams, saveResults, addSubject, updateSubject, deleteSubject, addExam, updateExam, deleteExam } = useData();
    const [isSaving, setIsSaving] = useState(false);

    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [defaultTotalMarks, setDefaultTotalMarks] = useState<number>(100);
    const [marks, setMarks] = useState<Map<string, { marks: number, totalMarks: number }>>(new Map());
    const [sortBy, setSortBy] = useState<'name' | 'rollNumber'>('rollNumber');

    // State for managing subjects
    const [isManageSubjectsOpen, setIsManageSubjectsOpen] = useState(false);
    const [isSubjectFormOpen, setIsSubjectFormOpen] = useState(false);
    const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
    const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

    // State for managing exams
    const [isManageExamsOpen, setIsManageExamsOpen] = useState(false);
    const [isExamFormOpen, setIsExamFormOpen] = useState(false);
    const [examToEdit, setExamToEdit] = useState<Exam | null>(null);
    const [examToDelete, setExamToDelete] = useState<Exam | null>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    const userClasses = useMemo(() => {
        if (!user) return [];
        let filteredClasses: Class[];
        if (effectiveRole === UserRole.Teacher) {
            filteredClasses = classes.filter((c: Class) => c.schoolId === effectiveSchoolId && c.teacherId === user.id);
        } else {
            filteredClasses = classes.filter((c: Class) => c.schoolId === effectiveSchoolId);
        }
        return filteredClasses.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name));
    }, [classes, user, effectiveRole, effectiveSchoolId]);

    const studentsInClass = useMemo(() => {
        if (!selectedClassId) return [];
        // FIX: Explicitly type 's' to ensure correct type inference.
        const filtered = students.filter((s: Student) => s.classId === selectedClassId && s.status === 'Active');
        
        return filtered.sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else {
                return a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true });
            }
        });
    }, [students, selectedClassId, sortBy]);
    
    useEffect(() => {
        if (userClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(userClasses[0].id);
        }
    }, [userClasses, selectedClassId]);

    useEffect(() => {
        const newMarks = new Map<string, { marks: number, totalMarks: number }>();
        const recordsForExamAndSubject = results.filter((r: Result) => r.classId === selectedClassId && r.exam === selectedExam && r.subject === selectedSubject);

        studentsInClass.forEach(student => {
            const existingRecord = recordsForExamAndSubject.find(r => r.studentId === student.id);
            newMarks.set(student.id, {
                marks: existingRecord ? existingRecord.marks : 0,
                // Use existing total marks if available, otherwise use the current default
                totalMarks: existingRecord ? existingRecord.totalMarks : defaultTotalMarks,
            });
        });
        setMarks(newMarks);
    }, [selectedClassId, selectedExam, selectedSubject, studentsInClass, results]); // removed defaultTotalMarks from dependency to avoid overwriting user edits on default change unless manual

    // Helper to update all total marks when default changes
    const handleDefaultTotalChange = (newTotal: number) => {
        setDefaultTotalMarks(newTotal);
        setMarks((prev: Map<string, { marks: number; totalMarks: number }>) => {
            const newMap = new Map<string, { marks: number; totalMarks: number }>(prev);
            // Update all rows to the new default for convenience
            Array.from(newMap.keys()).forEach(key => {
                const current = newMap.get(key);
                if (current) {
                    // FIX: Avoid spread on potentially undefined type
                    newMap.set(key, { marks: current.marks, totalMarks: newTotal });
                }
            });
            return newMap;
        });
    };

    const handleMarksChange = (studentId: string, value: string, field: 'marks' | 'totalMarks') => {
        const numValue = parseFloat(value);
        // Allow empty string during typing, treat as 0
        const finalValue = isNaN(numValue) ? 0 : numValue;

        setMarks((prev: Map<string, { marks: number, totalMarks: number }>) => {
            const newMarks = new Map(prev);
            const current = newMarks.get(studentId);
            
            const updatedEntry = {
                marks: current?.marks ?? 0,
                totalMarks: current?.totalMarks ?? defaultTotalMarks,
            };
            updatedEntry[field] = finalValue;

            newMarks.set(studentId, updatedEntry);
            return newMarks;
        });
    };
    
    const handleSaveResults = async () => {
        if (!selectedClassId || !selectedExam.trim() || !selectedSubject.trim()) {
            alert("Please select a class and provide both an exam and a subject name.");
            return;
        }
        setIsSaving(true);
        try {
            const resultsToSave: Omit<Result, 'id'>[] = Array.from(marks.entries())
                .map(([studentId, { marks: studentMarks, totalMarks }]) => ({
                    studentId,
                    classId: selectedClassId,
                    exam: selectedExam.trim(),
                    subject: selectedSubject.trim(),
                    marks: studentMarks,
                    totalMarks: totalMarks,
                }));
            await saveResults(resultsToSave);
        } catch (error) {
            console.error("Failed to save results:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const examsList = useMemo(() => {
        const examsFromResults = results.map(r => r.exam);
        const managedExams = exams.filter(e => e.schoolId === effectiveSchoolId).map(e => e.name);
        return [...new Set([...examsFromResults, ...managedExams])].sort();
    }, [results, exams, effectiveSchoolId]);
    
    const subjectsList = useMemo(() => {
        const subjectsFromResults = results.map(r => r.subject);
        const managedSubjects = subjects.filter(s => s.schoolId === effectiveSchoolId).map(s => s.name);
        return [...new Set([...subjectsFromResults, ...managedSubjects])].sort();
    }, [results, subjects, effectiveSchoolId]);

    const getGrade = (percentage: number) => {
        if (percentage >= 90) return 'A1+';
        if (percentage >= 80) return 'A1';
        if (percentage >= 70) return 'A';
        if (percentage >= 60) return 'B';
        if (percentage >= 50) return 'C';
        if (percentage >= 40) return 'D';
        return 'F';
    };

    // Handlers for subjects
    const handleOpenSubjectForm = (subject: Subject | null = null) => {
        setSubjectToEdit(subject);
        setIsSubjectFormOpen(true);
    };
    const handleSaveSubject = async (data: Omit<Subject, 'id' | 'schoolId'> | Subject) => {
        if (!effectiveSchoolId) return;
        if ('id' in data) {
            await updateSubject(data);
        } else {
            await addSubject({ ...data, schoolId: effectiveSchoolId });
        }
        setIsSubjectFormOpen(false);
    };
    const handleDeleteSubject = () => {
        if (subjectToDelete) {
            deleteSubject(subjectToDelete.id);
            setSubjectToDelete(null);
        }
    };
    
    // Handlers for exams
    const handleOpenExamForm = (exam: Exam | null = null) => {
        setExamToEdit(exam);
        setIsExamFormOpen(true);
    };
    const handleSaveExam = async (data: Omit<Exam, 'id' | 'schoolId'> | Exam) => {
        if (!effectiveSchoolId) return;
        if ('id' in data) {
            await updateExam(data);
        } else {
            await addExam({ ...data, schoolId: effectiveSchoolId });
        }
        setIsExamFormOpen(false);
    };
    const handleDeleteExam = () => {
        if (examToDelete) {
            deleteExam(examToDelete.id);
            setExamToDelete(null);
        }
    };

    return (
        <>
            <ReportCardModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Enter Results</h1>
                    <button onClick={() => setIsReportModalOpen(true)} className="btn-secondary">
                        <PrinterIcon className="w-4 h-4" />
                        Print Report
                    </button>
                </div>
                
                <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
                        <div>
                            <label htmlFor="class-select" className="input-label">Select Class</label>
                            <select id="class-select" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="input-field">
                                <option value="">Select Class</option>
                                {userClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <label htmlFor="exam-input" className="input-label">Exam</label>
                            <input id="exam-input" list="exams-list" value={selectedExam} onChange={e => setSelectedExam(e.target.value)} className="input-field pr-10" placeholder="E.g., Mid-Term"/>
                            <datalist id="exams-list">
                                {examsList.map(e => <option key={e} value={e} />)}
                            </datalist>
                            <button type="button" onClick={() => setIsManageExamsOpen(true)} className="absolute right-2 top-8 text-secondary-500 hover:text-primary-500" title="Manage Exams">
                                <CogIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="relative">
                            <label htmlFor="subject-input" className="input-label">Subject</label>
                            <input id="subject-input" list="subjects-list" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input-field pr-10" placeholder="E.g., Mathematics" />
                            <datalist id="subjects-list">
                                {subjectsList.map(s => <option key={s} value={s} />)}
                            </datalist>
                            <button type="button" onClick={() => setIsManageSubjectsOpen(true)} className="absolute right-2 top-8 text-secondary-500 hover:text-primary-500" title="Manage Subjects">
                                <CogIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div>
                            <label htmlFor="default-total" className="input-label">Default Total Marks</label>
                            <input 
                                id="default-total" 
                                type="number" 
                                value={defaultTotalMarks} 
                                onChange={e => handleDefaultTotalChange(Number(e.target.value))} 
                                className="input-field" 
                                min="0"
                            />
                        </div>
                        <div>
                            <label htmlFor="sort-by" className="input-label">Sort Students By</label>
                            <select id="sort-by" value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-field">
                                <option value="rollNumber">Student ID</option>
                                <option value="name">Student Name</option>
                            </select>
                        </div>
                    </div>
                </div>

                {selectedClassId && selectedExam && selectedSubject && (
                    <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Student</th>
                                        <th className="px-6 py-3 text-left">Father Name</th>
                                        <th className="px-6 py-3 text-left">Obtained Marks</th>
                                        <th className="px-6 py-3 text-left">Total Marks</th>
                                        <th className="px-6 py-3 text-center">Percentage</th>
                                        <th className="px-6 py-3 text-center">Grade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentsInClass.map(student => {
                                        const studentData = marks.get(student.id);
                                        const obtained = studentData?.marks || 0;
                                        const total = studentData?.totalMarks || defaultTotalMarks;
                                        const percentage = total > 0 ? (obtained / total) * 100 : 0;
                                        const grade = getGrade(percentage);
                                        const isFail = grade === 'F';

                                        return (
                                            <tr key={student.id} className="border-b dark:border-secondary-700">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar student={student} className="w-8 h-8"/>
                                                        <div>
                                                            <span className="font-medium text-secondary-900 dark:text-white">{student.name}</span>
                                                            <p className="text-xs font-bold text-primary-700 dark:text-primary-400">ID: {student.rollNumber}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-secondary-600 dark:text-secondary-400">{student.fatherName}</td>
                                                <td className="px-6 py-3">
                                                    <input 
                                                        type="number" 
                                                        value={obtained} 
                                                        onChange={(e) => handleMarksChange(student.id, e.target.value, 'marks')} 
                                                        className="input-field w-24" 
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input 
                                                        type="number" 
                                                        value={total} 
                                                        onChange={(e) => handleMarksChange(student.id, e.target.value, 'totalMarks')} 
                                                        className="input-field w-24" 
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="px-6 py-3 text-center font-medium">
                                                    {percentage.toFixed(1)}%
                                                </td>
                                                <td className={`px-6 py-3 text-center font-bold ${isFail ? 'text-red-600' : 'text-green-600'}`}>
                                                    {grade}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 flex justify-end">
                            <button onClick={handleSaveResults} disabled={isSaving} className="btn-primary">
                                {isSaving ? 'Saving...' : 'Save Results'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Subject Management Modals */}
            <Modal isOpen={isManageSubjectsOpen} onClose={() => setIsManageSubjectsOpen(false)} title="Manage Subjects">
                <div className="space-y-4">
                    <button onClick={() => handleOpenSubjectForm(null)} className="btn-primary w-full">+ Add New Subject</button>
                    <div className="max-h-60 overflow-y-auto border dark:border-secondary-600 rounded-md">
                        <ul className="divide-y dark:divide-secondary-600">
                            {subjects.filter(s => s.schoolId === effectiveSchoolId).map(subject => (
                                <li key={subject.id} className="p-2 flex justify-between items-center hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                    <span>{subject.name}</span>
                                    <div className="space-x-2">
                                        <button onClick={() => handleOpenSubjectForm(subject)} className="text-sm font-medium text-primary-600 hover:underline">Edit</button>
                                        <button onClick={() => setSubjectToDelete(subject)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal>
            <SubjectFormModal isOpen={isSubjectFormOpen} onClose={() => setIsSubjectFormOpen(false)} onSave={handleSaveSubject} subjectToEdit={subjectToEdit} />
            <Modal isOpen={!!subjectToDelete} onClose={() => setSubjectToDelete(null)} title="Confirm Delete Subject">
                <p>Are you sure you want to delete the subject "{subjectToDelete?.name}"?</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setSubjectToDelete(null)} className="btn-secondary">Cancel</button>
                    <button onClick={handleDeleteSubject} className="btn-danger">Delete</button>
                </div>
            </Modal>

            {/* Exam Management Modals */}
            <Modal isOpen={isManageExamsOpen} onClose={() => setIsManageExamsOpen(false)} title="Manage Exams">
                 <div className="space-y-4">
                    <button onClick={() => handleOpenExamForm(null)} className="btn-primary w-full">+ Add New Exam</button>
                    <div className="max-h-60 overflow-y-auto border dark:border-secondary-600 rounded-md">
                        <ul className="divide-y dark:divide-secondary-600">
                            {exams.filter(e => e.schoolId === effectiveSchoolId).map(exam => (
                                <li key={exam.id} className="p-2 flex justify-between items-center hover:bg-secondary-50 dark:hover:bg-secondary-700/50">
                                    <span>{exam.name}</span>
                                    <div className="space-x-2">
                                        <button onClick={() => handleOpenExamForm(exam)} className="text-sm font-medium text-primary-600 hover:underline">Edit</button>
                                        <button onClick={() => setExamToDelete(exam)} className="text-sm font-medium text-red-600 hover:underline">Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal>
            <ExamFormModal isOpen={isExamFormOpen} onClose={() => setIsExamFormOpen(false)} onSave={handleSaveExam} examToEdit={examToEdit} />
            <Modal isOpen={!!examToDelete} onClose={() => setExamToDelete(null)} title="Confirm Delete Exam">
                <p>Are you sure you want to delete the exam "{examToDelete?.name}"?</p>
                 <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setExamToDelete(null)} className="btn-secondary">Cancel</button>
                    <button onClick={handleDeleteExam} className="btn-danger">Delete</button>
                </div>
            </Modal>
        </>
    );
};

const ResultsPage: React.FC = () => {
    const { effectiveRole } = useAuth();
    
    const canEnterResults = effectiveRole === UserRole.Admin || effectiveRole === UserRole.Teacher;

    if (canEnterResults) {
        return <ResultsEntry />;
    } else {
        return <ResultsViewer />;
    }
};

export default ResultsPage;

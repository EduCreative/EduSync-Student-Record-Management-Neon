import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Class, UserRole } from '../../types';
import Modal from '../common/Modal';
import ClassFormModal from './ClassFormModal';
import TableSkeleton from '../common/skeletons/TableSkeleton';
import { DownloadIcon, UploadIcon } from '../../constants';
import { exportToCsv } from '../../utils/csvHelper';
import ImportModal from '../common/ImportModal';
import { Permission } from '../../permissions';
import PromotionPreviewModal from './PromotionPreviewModal';
import { useToast } from '../../context/ToastContext';
import { getClassLevel } from '../../utils/sorting';
import Avatar from '../common/Avatar';

const GraduationCapIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
const DragHandleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>;


const ClassManagementPage: React.FC = () => {
    const { user: currentUser, activeSchoolId, effectiveRole, hasPermission } = useAuth();
    const { classes, users, students, addClass, updateClass, deleteClass, loading, bulkAddClasses, promoteAllStudents, bulkUpdateClassOrder } = useData();
    const { showToast } = useToast();

    const effectiveSchoolId = currentUser?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : currentUser?.schoolId;

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
    const [promotionPlan, setPromotionPlan] = useState<any[]>([]);
    const [isPromoting, setIsPromoting] = useState(false);
    const [classToEdit, setClassToEdit] = useState<Class | null>(null);
    const [classToDelete, setClassToDelete] = useState<Class | null>(null);
    const [draggedItem, setDraggedItem] = useState<Class | null>(null);
    const [classToViewDetails, setClassToViewDetails] = useState<Class | null>(null);
    
    const canEditClasses = hasPermission(Permission.CAN_EDIT_CLASSES);
    const canDeleteClasses = hasPermission(Permission.CAN_DELETE_CLASSES);
    const canPromote = hasPermission(Permission.CAN_PROMOTE_STUDENTS);
    const canReorder = hasPermission(Permission.CAN_EDIT_CLASSES);

    const schoolClasses = useMemo(() => {
        let filteredClasses: Class[];
        if (effectiveRole === UserRole.Teacher) {
            filteredClasses = classes.filter(c => c.schoolId === effectiveSchoolId && c.teacherId === currentUser?.id);
        } else {
            filteredClasses = classes.filter(c => c.schoolId === effectiveSchoolId);
        }
        return [...filteredClasses].sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name));
    }, [classes, effectiveSchoolId, effectiveRole, currentUser]);
    
    const teachers = useMemo(() => users.filter(u => u.schoolId === effectiveSchoolId && u.role === UserRole.Teacher), [users, effectiveSchoolId]);
    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);
    const studentCountMap = useMemo(() => {
        return schoolClasses.reduce((acc, c) => {
            acc[c.id] = students.filter(s => s.classId === c.id && s.status === 'Active').length;
            return acc;
        }, {} as Record<string, number>);
    }, [students, schoolClasses]);

    const classMap = useMemo(() => new Map(classes.map(c => [c.id, `${c.name}${c.section ? ` - ${c.section}` : ''}`])), [classes]);

    const studentsInSelectedClass = useMemo(() => {
        if (!classToViewDetails) return [];
        return students.filter(s => s.classId === classToViewDetails.id && s.status === 'Active')
            .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
    }, [students, classToViewDetails]);

    const teacherOfSelectedClass = useMemo(() => {
        if (!classToViewDetails?.teacherId) return null;
        return users.find(u => u.id === classToViewDetails.teacherId);
    }, [users, classToViewDetails]);

    const handleOpenModal = (classData: Class | null = null) => {
        setClassToEdit(classData);
        setIsFormModalOpen(true);
    };

    const handleCloseModal = () => {
        setClassToEdit(null);
        setIsFormModalOpen(false);
    };

    const handleSaveClass = async (data: Class | Omit<Class, 'id'>) => {
        if ('id' in data) {
            await updateClass(data);
        } else {
            await addClass(data);
        }
    };
    
    const handleDeleteClass = () => {
        if (classToDelete) {
            deleteClass(classToDelete.id);
            setClassToDelete(null);
        }
    };

    const validateClassImport = async (data: any[]) => {
        const validRecords: any[] = [];
        const invalidRecords: { record: any, reason: string, rowNum: number }[] = [];

        data.forEach((item, index) => {
            if (!item.name || !item.name.trim()) {
                invalidRecords.push({ record: item, reason: 'Class name is required.', rowNum: index + 2 });
            } else {
                validRecords.push(item);
            }
        });
        return { validRecords, invalidRecords };
    };

    const handleImportClasses = async (validData: any[], progressCallback: (progress: { processed: number; total: number; errors: string[] }) => void) => {
        if (!effectiveSchoolId) {
            throw new Error("No active school selected. Cannot import classes.");
        }
        
        const CHUNK_SIZE = 50;
        let processed = 0;

        for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
            const chunk = validData.slice(i, i + CHUNK_SIZE);
            const classesToImport = chunk.map(item => ({
                name: item.name,
                teacherId: item.teacherId || null,
                schoolId: effectiveSchoolId,
            }));

            if (classesToImport.length > 0) {
                await bulkAddClasses(classesToImport);
            }
            
            processed += chunk.length;
            progressCallback({ processed, total: validData.length, errors: [] });
        }
    };

    const sampleDataForImport = [{
        name: "Grade 1 - Section A",
        teacherId: teachers[0]?.id || "paste_valid_teacher_id_or_leave_blank"
    }];

    const requiredHeaders = ['name'];

    const handleExport = () => {
        const dataToExport = schoolClasses.map(c => ({
            sortOrder: c.sortOrder || '',
            name: c.name,
            section: c.section || '',
            teacherId: c.teacherId || '',
            teacherName_for_reference: c.teacherId ? teacherMap.get(c.teacherId) || 'N/A' : 'N/A',
            studentCount_for_reference: studentCountMap[c.id] || 0,
        }));
        exportToCsv(dataToExport, 'classes_export');
    };
    
    const handleCalculateAndShowPreview = () => {
        const sortedClasses = schoolClasses;
    
        if (sortedClasses.length < 1) {
            showToast('Info', 'At least one class is required to perform promotion.', 'info');
            return;
        }
    
        const plan = [];
        for (let i = 0; i < sortedClasses.length; i++) {
            const fromClass = sortedClasses[i];
            const totalStudentCount = students.filter(s => s.classId === fromClass.id && s.status === 'Active').length;
    
            if (i < sortedClasses.length - 1) {
                const toClass = sortedClasses[i + 1];
                plan.push({
                    from: fromClass,
                    to: toClass,
                    totalStudentCount: totalStudentCount,
                });
            } else {
                plan.push({
                    from: fromClass,
                    to: null, // Indicates graduation
                    totalStudentCount: totalStudentCount,
                });
            }
        }
        setPromotionPlan(plan);
        setIsPromoteModalOpen(true);
    };

    const handleConfirmPromotion = async (mappings: Record<string, string | 'graduate'>, exemptedStudentIds: string[]) => {
        setIsPromoting(true);
        try {
            await promoteAllStudents(mappings, exemptedStudentIds);
        } catch (error) {
            console.error("Promotion failed:", error);
        } finally {
            setIsPromoting(false);
            setIsPromoteModalOpen(false);
        }
    };

    const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, item: Class) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.id);
        e.currentTarget.classList.add('opacity-50');
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary-100', 'dark:bg-primary-900/50');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLTableRowElement>) => {
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/50');
    };

    const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetItem: Class) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-primary-100', 'dark:bg-primary-900/50');
        if (!draggedItem || draggedItem.id === targetItem.id) {
            return;
        }

        const currentItems = [...schoolClasses];
        const draggedIndex = currentItems.findIndex(c => c.id === draggedItem.id);
        const targetIndex = currentItems.findIndex(c => c.id === targetItem.id);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [reorderedItem] = currentItems.splice(draggedIndex, 1);
        currentItems.splice(targetIndex, 0, reorderedItem);

        const updates = currentItems.map((c, index) => ({
            id: c.id,
            sortOrder: index + 1,
        }));
        
        try {
            await bulkUpdateClassOrder(updates);
        } catch (error) {
            console.error("Failed to reorder classes:", error);
        }
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
        setDraggedItem(null);
        e.currentTarget.classList.remove('opacity-50');
    };

    const showActionsColumn = canEditClasses || canDeleteClasses || effectiveRole === UserRole.Teacher;

    const tableColumns = [
        ...(canReorder ? [{ width: '5%' }] : []),
        { width: '10%' }, // ID
        { width: showActionsColumn ? '25%' : '40%' }, // Name
        { width: showActionsColumn ? '25%' : '30%' }, // Teacher
        { width: '15%' }, // Students
    ];
    if (showActionsColumn) {
        tableColumns.push({ width: '20%' }); // Actions
    }


    return (
        <>
            {canEditClasses && (
                <>
                    <ClassFormModal 
                        isOpen={isFormModalOpen}
                        onClose={handleCloseModal}
                        onSave={handleSaveClass}
                        classToEdit={classToEdit}
                    />
                    <ImportModal
                        isOpen={isImportModalOpen}
                        onClose={() => setIsImportModalOpen(false)}
                        onValidate={validateClassImport}
                        onImport={handleImportClasses}
                        sampleData={sampleDataForImport}
                        fileName="Classes"
                        requiredHeaders={requiredHeaders}
                    />
                </>
            )}
            {canPromote && (
                <PromotionPreviewModal
                    isOpen={isPromoteModalOpen}
                    onClose={() => setIsPromoteModalOpen(false)}
                    onConfirm={handleConfirmPromotion}
                    promotionPlan={promotionPlan}
                    isPromoting={isPromoting}
                    allStudents={students}
                    allClasses={schoolClasses}
                />
            )}
            <Modal isOpen={!!classToDelete} onClose={() => setClassToDelete(null)} title="Confirm Class Deletion">
                <div>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                        Are you sure you want to delete the class <strong className="text-secondary-800 dark:text-secondary-200">{classToDelete?.name}</strong>? This action cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setClassToDelete(null)} className="btn-secondary">Cancel</button>
                        <button type="button" onClick={handleDeleteClass} className="btn-danger">Delete</button>
                    </div>
                </div>
            </Modal>
             <Modal isOpen={!!classToViewDetails} onClose={() => setClassToViewDetails(null)} title={`Details for ${classMap.get(classToViewDetails?.id || '')}`}>
                {classToViewDetails && (
                    <div className="space-y-4">
                        <div className="p-3 bg-secondary-50 dark:bg-secondary-700/50 rounded-lg">
                            <h3 className="font-semibold text-lg text-secondary-800 dark:text-secondary-200">Class Information</h3>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                <p><strong>Teacher:</strong> {teacherOfSelectedClass?.name || 'Not Assigned'}</p>
                                <p><strong>Total Active Students:</strong> {studentsInSelectedClass.length}</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-secondary-800 dark:text-secondary-200">Student List</h3>
                            <div className="max-h-64 overflow-y-auto border rounded-md mt-2 dark:border-secondary-600">
                                <ul className="divide-y dark:divide-secondary-600">
                                    {studentsInSelectedClass.length > 0 ? studentsInSelectedClass.map(student => (
                                        <li key={student.id} className="p-2 flex items-center space-x-3">
                                            <Avatar student={student} className="w-8 h-8"/>
                                            <div>
                                                <p className="font-medium text-sm">{student.name}</p>
                                                <p className="text-xs font-bold text-primary-700 dark:text-primary-400">ID: {student.rollNumber}</p>
                                            </div>
                                        </li>
                                    )) : (
                                        <p className="p-4 text-center text-sm text-secondary-500">No active students in this class.</p>
                                    )}
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4 pt-4 border-t dark:border-secondary-700">
                            <button onClick={() => setClassToViewDetails(null)} className="btn-secondary">Close</button>
                        </div>
                    </div>
                )}
            </Modal>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">{canEditClasses ? 'Class Management' : 'My Classes'}</h1>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                         {canEditClasses && (
                             <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary">
                                <UploadIcon className="w-4 h-4" /> Import CSV
                            </button>
                         )}
                        <button onClick={handleExport} className="btn-secondary">
                           <DownloadIcon className="w-4 h-4" /> Export CSV
                        </button>
                        {canPromote && (
                            <button onClick={handleCalculateAndShowPreview} className="btn-danger flex items-center gap-2">
                                <GraduationCapIcon className="w-4 h-4" /> 
                                Promote All Students
                            </button>
                        )}
                        {canEditClasses && (
                            <button onClick={() => handleOpenModal()} className="btn-primary">
                                + Add Class
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                    {loading ? (
                        <TableSkeleton columns={tableColumns} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-secondary-500 dark:text-secondary-400">
                                <thead className="text-xs text-secondary-700 uppercase bg-secondary-50 dark:bg-secondary-700 dark:text-secondary-300">
                                    <tr>
                                        {canReorder && <th scope="col" className="px-2 py-3 w-12"></th>}
                                        <th scope="col" className="px-6 py-3">ID</th>
                                        <th scope="col" className="px-6 py-3">Class Name</th>
                                        <th scope="col" className="px-6 py-3">Teacher</th>
                                        <th scope="col" className="px-6 py-3">No. of Students</th>
                                        {showActionsColumn && <th scope="col" className="px-6 py-3">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {schoolClasses.map((c, index) => (
                                        <tr
                                            key={c.id}
                                            draggable={canReorder}
                                            onDragStart={canReorder ? (e) => handleDragStart(e, c) : undefined}
                                            onDragOver={canReorder ? handleDragOver : undefined}
                                            onDragLeave={canReorder ? handleDragLeave : undefined}
                                            onDrop={canReorder ? (e) => handleDrop(e, c) : undefined}
                                            onDragEnd={canReorder ? handleDragEnd : undefined}
                                            className="bg-white dark:bg-secondary-800 border-b dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700/50"
                                        >
                                            {canReorder && (
                                                <td className="px-2 py-4 text-secondary-400 cursor-move">
                                                    <DragHandleIcon className="w-5 h-5" />
                                                </td>
                                            )}
                                            <td className="px-6 py-4">{index + 1}</td>
                                            <td className="px-6 py-4 font-medium text-secondary-900 dark:text-white">{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</td>
                                            <td className="px-6 py-4">{c.teacherId ? teacherMap.get(c.teacherId) || 'Not Assigned' : 'Not Assigned'}</td>
                                            <td className="px-6 py-4">{studentCountMap[c.id] || 0}</td>
                                            {showActionsColumn && (
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-4">
                                                        <button onClick={() => setClassToViewDetails(c)} className="font-medium text-blue-600 dark:text-blue-500 hover:underline">Details</button>
                                                        {canEditClasses && <button onClick={() => handleOpenModal(c)} className="font-medium text-primary-600 dark:text-primary-500 hover:underline">Edit</button>}
                                                        {canDeleteClasses && <button onClick={() => setClassToDelete(c)} className="font-medium text-red-600 dark:text-red-500 hover:underline">Delete</button>}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ClassManagementPage;
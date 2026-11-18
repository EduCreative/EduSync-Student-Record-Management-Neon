import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { Student, UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ImageUpload from '../common/ImageUpload';
import { getClassLevel } from '../../utils/sorting';
import { getTodayKarachi } from '../../utils/dates';

interface StudentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (studentData: (Student | Omit<Student, 'id' | 'status'>) & { parentIds?: string[] }) => Promise<void>;
    studentToEdit?: Student | null;
}

const getTodayString = () => getTodayKarachi();

// Helper functions for formatting
const formatCnic = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
};

const formatPhoneNumber = (value: string): string => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

const StudentFormModal: React.FC<StudentFormModalProps> = ({ isOpen, onClose, onSave, studentToEdit }) => {
    const { user, activeSchoolId } = useAuth();
    const { classes, users, students } = useData();
    const { showToast } = useToast();

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    
    const getInitialFormData = () => ({
        name: '',
        rollNumber: '',
        classId: '',
        fatherName: '',
        fatherCnic: '',
        dateOfBirth: '',
        dateOfAdmission: getTodayString(),
        admittedClass: '',
        caste: '',
        grNumber: '',
        religion: '',
        lastSchoolAttended: '',
        contactNumber: '',
        address: '',
        gender: 'Male' as 'Male' | 'Female',
        avatarUrl: null as string | null | undefined,
        schoolId: effectiveSchoolId || '',
        userId: '',
        secondaryContactNumber: '',
        openingBalance: 0,
        status: 'Active',
        receiveBispSupport: false,
        feeStructure: [] as { feeHeadId: string; amount: number }[],
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
    const [parentSearchTerm, setParentSearchTerm] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const targetSchoolId = studentToEdit?.schoolId || formData.schoolId || effectiveSchoolId || null;

    const schoolClasses = useMemo(() => classes.filter(c => !targetSchoolId || c.schoolId === targetSchoolId)
        .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), 
        [classes, targetSchoolId]);

    const legacyNonStudentUser = useMemo(() => {
        if (!studentToEdit?.userId) return null;
        const found = users.find(u => u.id === studentToEdit.userId);
        return found && found.role !== UserRole.Student ? found : null;
    }, [studentToEdit?.userId, users]);

    const studentUsers = useMemo(() => {
        return users.filter(u =>
            u.role === UserRole.Student &&
            (!targetSchoolId || !u.schoolId || u.schoolId === targetSchoolId) &&
            (u.status !== 'Inactive' && u.status !== 'Suspended' || u.id === studentToEdit?.userId)
        );
    }, [users, targetSchoolId, studentToEdit?.userId]);

    const parentUsers = useMemo(() => {
        const selectedSet = new Set(selectedParentIds);
        return users.filter(u =>
            u.role === UserRole.Parent &&
            (!targetSchoolId || !u.schoolId || u.schoolId === targetSchoolId) &&
            (u.status !== 'Inactive' && u.status !== 'Suspended' || selectedSet.has(u.id))
        );
    }, [users, targetSchoolId, selectedParentIds]);

    const filteredParentUsers = useMemo(() => {
        const term = parentSearchTerm.trim().toLowerCase();
        if (!term) return parentUsers;
        return parentUsers.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.email.toLowerCase().includes(term)
        );
    }, [parentUsers, parentSearchTerm]);

    const studentAccountTakenMap = useMemo(() => {
        const map = new Map<string, Student>();
        students.forEach(s => {
            if (s.userId && s.status !== 'Deleted' && s.id !== studentToEdit?.id) {
                map.set(s.userId, s);
            }
        });
        return map;
    }, [students, studentToEdit?.id]);

    useEffect(() => {
        if (isOpen) {
            if (studentToEdit) {
                const matchedUser = studentToEdit.userId ? users.find(u => u.id === studentToEdit.userId) : null;
                const validStudentUserId = matchedUser && matchedUser.role === UserRole.Student ? studentToEdit.userId! : '';

                setFormData({
                    name: studentToEdit.name,
                    rollNumber: studentToEdit.rollNumber,
                    classId: studentToEdit.classId,
                    fatherName: studentToEdit.fatherName,
                    fatherCnic: studentToEdit.fatherCnic,
                    dateOfBirth: studentToEdit.dateOfBirth || '',
                    dateOfAdmission: studentToEdit.dateOfAdmission || '',
                    admittedClass: studentToEdit.admittedClass,
                    caste: studentToEdit.caste || '',
                    grNumber: studentToEdit.grNumber || '',
                    religion: studentToEdit.religion || '',
                    lastSchoolAttended: studentToEdit.lastSchoolAttended || '',
                    contactNumber: studentToEdit.contactNumber,
                    address: studentToEdit.address,
                    gender: studentToEdit.gender,
                    avatarUrl: studentToEdit.avatarUrl,
                    schoolId: studentToEdit.schoolId,
                    userId: validStudentUserId,
                    secondaryContactNumber: studentToEdit.secondaryContactNumber || '',
                    openingBalance: studentToEdit.openingBalance || 0,
                    status: studentToEdit.status,
                    receiveBispSupport: Boolean(studentToEdit.receiveBispSupport),
                    feeStructure: studentToEdit.feeStructure || [],
                });

                const linkedParents = users
                    .filter(u =>
                        u.role === UserRole.Parent &&
                        Array.isArray(u.childStudentIds) &&
                        u.childStudentIds.includes(studentToEdit.id)
                    )
                    .map(u => u.id);
                setSelectedParentIds(linkedParents);
            } else {
                const schoolStudents = students.filter(s => !effectiveSchoolId || s.schoolId === effectiveSchoolId);
                
                // Calculate next roll number
                const studentRollNumbers = schoolStudents
                    .map(s => parseInt(s.rollNumber, 10))
                    .filter(n => !isNaN(n));
                
                const maxRollNo = studentRollNumbers.length > 0 ? Math.max(...studentRollNumbers) : 0;
                const nextRollNo = String(maxRollNo + 1);

                // Calculate next GR number
                const studentGrNumbers = schoolStudents
                    .map(s => s.grNumber ? parseInt(String(s.grNumber).replace(/\D/g, ''), 10) : 0)
                    .filter(n => !isNaN(n));

                const maxGrNo = studentGrNumbers.length > 0 ? Math.max(...studentGrNumbers) : 0;
                const nextGrNo = String(maxGrNo + 1);

                setFormData({
                    ...getInitialFormData(),
                    rollNumber: nextRollNo,
                    grNumber: nextGrNo,
                });
                setSelectedParentIds([]);
            }
            setParentSearchTerm('');
            setErrors({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentToEdit?.id, isOpen, effectiveSchoolId]);

    // Sync "Admitted in Class" with "Class" for new students
    useEffect(() => {
        if (!studentToEdit && formData.classId) {
            const selectedClass = schoolClasses.find(c => c.id === formData.classId);
            if (selectedClass) {
                const fullName = `${selectedClass.name}${selectedClass.section ? ` - ${selectedClass.section}` : ''}`;
                setFormData(prev => ({ ...prev, admittedClass: fullName }));
            }
        }
    }, [formData.classId, studentToEdit, schoolClasses]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = 'Student name is required.';
        if (!formData.rollNumber.trim()) newErrors.rollNumber = 'Roll number is required.';
        if (!formData.classId) newErrors.classId = 'Please select a class.';
        if (!formData.fatherName.trim()) newErrors.fatherName = "Father's name is required.";
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required.';
        if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required.';
        if (!formData.admittedClass.trim()) newErrors.admittedClass = 'Admitted in Class is required.';
        
        // Check for duplicate roll number
        const isDuplicateRoll = students.some(s => 
            (!targetSchoolId || s.schoolId === targetSchoolId) && 
            s.rollNumber.trim().toLowerCase() === formData.rollNumber.trim().toLowerCase() && 
            s.id !== studentToEdit?.id
        );
        if (isDuplicateRoll) {
            newErrors.rollNumber = 'This roll number is already in use.';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        let formattedValue = value;
        if (name === 'fatherCnic') {
            formattedValue = formatCnic(value);
        } else if (name === 'contactNumber' || name === 'secondaryContactNumber') {
            formattedValue = formatPhoneNumber(value);
        }

        setFormData(prev => ({ ...prev, [name]: formattedValue }));
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name as keyof typeof errors];
                return newErrors;
            });
        }
    };

    const toggleParentLink = (parentId: string) => {
        setSelectedParentIds(prev =>
            prev.includes(parentId)
                ? prev.filter(id => id !== parentId)
                : [...prev, parentId]
        );
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            showToast('Validation Error', 'Please fill in all required fields highlighted in red.', 'error');
            return;
        }
        
        setIsSaving(true);
        try {
            const saveData = {
                ...formData,
                userId: formData.userId || null, 
                openingBalance: Number(formData.openingBalance) || 0,
                dateOfAdmission: formData.dateOfAdmission || null,
                dateOfBirth: formData.dateOfBirth || null,
            };

            if (studentToEdit) {
                const { feeStructure: _ignoredEdit, ...restOfEdit } = studentToEdit;
                const { feeStructure: _ignoredSave, ...restOfSave } = saveData;
                await onSave({ ...restOfEdit, ...restOfSave, parentIds: selectedParentIds });
            } else {
                const { status, ...rest } = saveData;
                await onSave({ ...rest, parentIds: selectedParentIds });
            }
            onClose();
        } catch (error: any) {
            console.error("Failed to save student:", error);
            showToast('Error', error?.message || 'Failed to save student.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={studentToEdit ? 'Edit Student' : 'Add New Student'}>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" noValidate>
                 <ImageUpload 
                  imageUrl={formData.avatarUrl}
                  onChange={(newAvatarUrl) => setFormData(prev => ({...prev, avatarUrl: newAvatarUrl}))}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="input-label">Student Name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="w-full input-field" required />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                     <div>
                        <label htmlFor="rollNumber" className="input-label">Roll Number</label>
                        <input type="text" name="rollNumber" id="rollNumber" value={formData.rollNumber} onChange={handleChange} className="w-full input-field" required />
                        {errors.rollNumber && <p className="text-red-500 text-xs mt-1">{errors.rollNumber}</p>}
                    </div>
                     <div>
                        <label htmlFor="classId" className="input-label">Class</label>
                        <select name="classId" id="classId" value={formData.classId} onChange={handleChange} className="w-full input-field" required>
                            <option value="">Select Class</option>
                            {schoolClasses.map(c => <option key={c.id} value={c.id}>{`${c.name}${c.section ? ` - ${c.section}` : ''}`}</option>)}
                        </select>
                        {errors.classId && <p className="text-red-500 text-xs mt-1">{errors.classId}</p>}
                    </div>
                     {studentToEdit && (
                        <div>
                            <label htmlFor="status" className="input-label">Status</label>
                            <select name="status" id="status" value={formData.status} onChange={handleChange} className="w-full input-field" disabled={formData.status === 'Left' || formData.status.includes('Passed')}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Graduated">Graduated</option>
                                {formData.status === 'Left' && <option value="Left">Left</option>}
                                {formData.status.includes('Passed') && <option value={formData.status}>{formData.status}</option>}
                            </select>
                            <p className="text-xs text-secondary-500 mt-1">Status 'Left' or 'Passed' is set via other actions.</p>
                        </div>
                    )}
                    <div className="md:col-span-2 p-4 rounded-lg bg-secondary-50 dark:bg-secondary-700/40 border border-secondary-200 dark:border-secondary-600 space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">Portal Account Linking</h3>
                            <p className="text-xs text-secondary-500 dark:text-secondary-400">
                                Connect this student record to a Student login account (1-to-1) and/or one or more Parent login accounts.
                            </p>
                        </div>

                        {legacyNonStudentUser && (
                            <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                                Previously linked account <strong>{legacyNonStudentUser.name}</strong> ({legacyNonStudentUser.email}) has role <strong>{legacyNonStudentUser.role}</strong> and was cleared from the Student Login field. Select them under <strong>Link Parent Account(s)</strong> below if they are a parent.
                            </div>
                        )}

                        <div>
                            <label htmlFor="userId" className="input-label">Link Student Login Account</label>
                            <select name="userId" id="userId" value={formData.userId || ''} onChange={handleChange} className="w-full input-field">
                                <option value="">No Student Account Linked</option>
                                {studentUsers.map(u => {
                                    const takenBy = studentAccountTakenMap.get(u.id);
                                    const isDisabled = Boolean(takenBy && formData.userId !== u.id);
                                    const statusTag = u.status !== 'Active' ? ` [${u.status}]` : '';
                                    const takenTag = takenBy ? ` — Linked to ${takenBy.name} (#${takenBy.rollNumber})` : '';
                                    return (
                                        <option key={u.id} value={u.id} disabled={isDisabled}>
                                            {u.name} - {u.email}{statusTag}{takenTag}
                                        </option>
                                    );
                                })}
                            </select>
                            {studentUsers.length === 0 && (
                                <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                                    No Student user accounts found yet. Create or approve a Student account in User Management first.
                                </p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="input-label mb-0">Link Parent Account(s)</label>
                                <span className="text-xs text-secondary-500 dark:text-secondary-400">
                                    {selectedParentIds.length} selected
                                </span>
                            </div>

                            {selectedParentIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {selectedParentIds.map(pid => {
                                        const parent = users.find(u => u.id === pid);
                                        if (!parent) return null;
                                        return (
                                            <span
                                                key={pid}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200 border border-primary-200 dark:border-primary-800"
                                            >
                                                <span>{parent.name} ({parent.email})</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleParentLink(pid)}
                                                    className="text-primary-600 hover:text-primary-900 dark:text-primary-300 dark:hover:text-white font-bold leading-none"
                                                    aria-label={`Unlink ${parent.name}`}
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {parentUsers.length > 0 ? (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Search parent accounts by name or email..."
                                        value={parentSearchTerm}
                                        onChange={e => setParentSearchTerm(e.target.value)}
                                        className="w-full input-field text-sm py-1.5"
                                    />
                                    <div className="max-h-36 overflow-y-auto border border-secondary-200 dark:border-secondary-600 rounded-md bg-white dark:bg-secondary-800 divide-y divide-secondary-100 dark:divide-secondary-700">
                                        {filteredParentUsers.length > 0 ? filteredParentUsers.map(p => {
                                            const isChecked = selectedParentIds.includes(p.id);
                                            const childCount = Array.isArray(p.childStudentIds) ? p.childStudentIds.length : 0;
                                            return (
                                                <label
                                                    key={p.id}
                                                    className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-700/60 text-sm"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleParentLink(p.id)}
                                                            className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500 shrink-0"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-secondary-900 dark:text-white truncate">
                                                                {p.name}
                                                                {p.status !== 'Active' && (
                                                                    <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">[{p.status}]</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-secondary-500 dark:text-secondary-400 truncate">{p.email}</div>
                                                        </div>
                                                    </div>
                                                    {childCount > 0 && (
                                                        <span className="text-xs text-secondary-500 dark:text-secondary-400 shrink-0">
                                                            {childCount} {childCount === 1 ? 'child' : 'children'}
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        }) : (
                                            <div className="p-3 text-xs text-secondary-500 text-center">No matching parent accounts.</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-secondary-500 dark:text-secondary-400">
                                    No Parent user accounts found yet. Create or approve a Parent account in User Management first.
                                </p>
                            )}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="fatherName" className="input-label">Father's Name</label>
                        <input type="text" name="fatherName" id="fatherName" value={formData.fatherName} onChange={handleChange} className="w-full input-field" required />
                        {errors.fatherName && <p className="text-red-500 text-xs mt-1">{errors.fatherName}</p>}
                    </div>
                    <div>
                        <label htmlFor="fatherCnic" className="input-label">Father's CNIC</label>
                        <input type="text" name="fatherCnic" id="fatherCnic" value={formData.fatherCnic} onChange={handleChange} className="w-full input-field" maxLength={15} placeholder="XXXXX-XXXXXXX-X" />
                    </div>
                     <div>
                        <label htmlFor="grNumber" className="input-label">GR Number</label>
                        <input type="text" name="grNumber" id="grNumber" value={formData.grNumber} onChange={handleChange} className="w-full input-field" />
                        {errors.grNumber && <p className="text-red-500 text-xs mt-1">{errors.grNumber}</p>}
                    </div>
                    <div>
                        <label htmlFor="religion" className="input-label">Religion</label>
                        <input type="text" name="religion" id="religion" value={formData.religion} onChange={handleChange} className="w-full input-field" />
                    </div>
                    <div>
                        <label htmlFor="caste" className="input-label">Caste</label>
                        <input type="text" name="caste" id="caste" value={formData.caste} onChange={handleChange} className="w-full input-field" />
                    </div>
                     <div>
                        <label htmlFor="gender" className="input-label">Gender</label>
                        <select name="gender" id="gender" value={formData.gender} onChange={handleChange} className="w-full input-field">
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="dateOfBirth" className="input-label">Date of Birth</label>
                        <input type="date" name="dateOfBirth" id="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="w-full input-field" required />
                        {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
                    </div>
                     <div>
                        <label htmlFor="dateOfAdmission" className="input-label">Date of Admission</label>
                        <input type="date" name="dateOfAdmission" id="dateOfAdmission" value={formData.dateOfAdmission} onChange={handleChange} className="w-full input-field" />
                    </div>
                     <div>
                        <label htmlFor="admittedClass" className="input-label">Admitted in Class</label>
                        <select name="admittedClass" id="admittedClass" value={formData.admittedClass} onChange={handleChange} className="w-full input-field" required>
                            <option value="">Select Admission Class</option>
                            {schoolClasses.map(c => {
                                const fullName = `${c.name}${c.section ? ` - ${c.section}` : ''}`;
                                return <option key={c.id} value={fullName}>{fullName}</option>
                            })}
                        </select>
                        {errors.admittedClass && <p className="text-red-500 text-xs mt-1">{errors.admittedClass}</p>}
                    </div>
                     <div>
                        <label htmlFor="openingBalance" className="input-label">Opening Balance (Arrears)</label>
                        <input type="number" name="openingBalance" id="openingBalance" value={formData.openingBalance} onChange={handleChange} className="w-full input-field" />
                    </div>
                    <div>
                        <label htmlFor="contactNumber" className="input-label">Contact Number</label>
                        <input type="tel" name="contactNumber" id="contactNumber" value={formData.contactNumber} onChange={handleChange} className="w-full input-field" required maxLength={12} placeholder="XXXX-XXXXXXX" />
                        {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
                    </div>
                    <div>
                        <label htmlFor="secondaryContactNumber" className="input-label">Secondary Contact</label>
                        <input type="tel" name="secondaryContactNumber" id="secondaryContactNumber" value={formData.secondaryContactNumber} onChange={handleChange} className="w-full input-field" maxLength={12} placeholder="XXXX-XXXXXXX" />
                    </div>
                    <div>
                        <label htmlFor="lastSchoolAttended" className="input-label">Last School Attended</label>
                        <input type="text" name="lastSchoolAttended" id="lastSchoolAttended" value={formData.lastSchoolAttended} onChange={handleChange} className="w-full input-field" />
                    </div>
                    <div>
                        <label htmlFor="receiveBispSupport" className="input-label">Receive BISP Support</label>
                        <select
                            name="receiveBispSupport"
                            id="receiveBispSupport"
                            value={formData.receiveBispSupport ? 'yes' : 'no'}
                            onChange={e => setFormData(prev => ({ ...prev, receiveBispSupport: e.target.value === 'yes' }))}
                            className="w-full input-field"
                        >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                        </select>
                        <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                            Informational only (does not affect fee challans).
                        </p>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="address" className="input-label">Address</label>
                        <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows={3} className="w-full input-field"></textarea>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Student'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StudentFormModal;
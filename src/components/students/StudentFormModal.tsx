import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { Student } from '../../types';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import ImageUpload from '../common/ImageUpload';
import { getClassLevel } from '../../utils/sorting';

interface StudentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (studentData: Student | Omit<Student, 'id' | 'status'>) => Promise<void>;
    studentToEdit?: Student | null;
}

const getTodayString = () => {
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    return localDate.toISOString().split('T')[0];
};

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
        feeStructure: [] as { feeHeadId: string; amount: number }[],
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    
    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId)
        .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || getClassLevel(a.name) - getClassLevel(b.name)), 
        [classes, effectiveSchoolId]);
    const parentUsers = useMemo(() => users.filter(u => u.schoolId === effectiveSchoolId && u.role === UserRole.Parent), [users, effectiveSchoolId]);

    useEffect(() => {
        if (isOpen) {
            if (studentToEdit) {
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
                    userId: studentToEdit.userId ?? '', 
                    secondaryContactNumber: studentToEdit.secondaryContactNumber || '',
                    openingBalance: studentToEdit.openingBalance || 0,
                    status: studentToEdit.status,
                    feeStructure: studentToEdit.feeStructure || [],
                });
            } else {
                const schoolStudents = students.filter(s => s.schoolId === effectiveSchoolId);
                
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
            }
            setErrors({});
        }
    }, [studentToEdit, isOpen, students, effectiveSchoolId]);

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
            s.schoolId === effectiveSchoolId && 
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
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        
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
                await onSave({ ...studentToEdit, ...saveData });
            } else {
                const { status, ...rest } = saveData;
                await onSave(rest);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save student:", error);
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
                                {formData.status === 'Left' && <option value="Left">Left</option>}
                                {formData.status.includes('Passed') && <option value={formData.status}>{formData.status}</option>}
                            </select>
                            <p className="text-xs text-secondary-500 mt-1">Status 'Left' or 'Passed' is set via other actions.</p>
                        </div>
                    )}
                     <div>
                        <label htmlFor="userId" className="input-label">Link Parent Account</label>
                        <select name="userId" id="userId" value={formData.userId || ''} onChange={handleChange} className="w-full input-field">
                            <option value="">Select Parent (Optional)</option>
                            {parentUsers.map(p => <option key={p.id} value={p.id}>{p.name} - {p.email}</option>)}
                        </select>
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
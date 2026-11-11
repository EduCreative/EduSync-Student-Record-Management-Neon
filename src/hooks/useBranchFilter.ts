import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { UserRole, Branch } from '../types';

const STORAGE_KEY = 'edusync_selected_branch';

export interface UseBranchFilterResult {
    selectedBranchId: string;
    setSelectedBranchId: (id: string) => void;
    branches: Branch[];
    hasMultipleBranches: boolean;
    hasUnassignedClasses: boolean;
    selectedBranchName: string;
    filterClasses: <T extends { id?: string; branchId?: string | null }>(items: T[]) => T[];
    filterStudents: <T extends { id?: string; classId?: string | null }>(items: T[]) => T[];
    filterFees: <T extends { studentId?: string }>(items: T[]) => T[];
    filterAttendance: <T extends { studentId?: string; classId?: string }>(items: T[]) => T[];
    filterResults: <T extends { studentId?: string; classId?: string }>(items: T[]) => T[];
}

export function useBranchFilter(): UseBranchFilterResult {
    const { user, activeSchoolId } = useAuth();
    const { branches, classes, students } = useData();

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    // Current school's branches (sorted by name)
    const schoolBranches = useMemo(() => {
        const list = effectiveSchoolId
            ? branches.filter(b => b.schoolId === effectiveSchoolId)
            : branches;
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [branches, effectiveSchoolId]);

    const hasMultipleBranches = schoolBranches.length >= 2;

    const schoolClasses = useMemo(() => {
        return effectiveSchoolId
            ? classes.filter(c => c.schoolId === effectiveSchoolId)
            : classes;
    }, [classes, effectiveSchoolId]);

    const hasUnassignedClasses = useMemo(() => {
        return schoolClasses.some(c => !c.branchId);
    }, [schoolClasses]);

    const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'all';
        } catch {
            return 'all';
        }
    });

    // Reset to 'all' if remembered branch no longer exists in current school
    useEffect(() => {
        if (selectedBranchId !== 'all' && selectedBranchId !== 'unassigned') {
            const exists = schoolBranches.some(b => b.id === selectedBranchId);
            if (!exists) {
                setSelectedBranchIdState('all');
                try {
                    localStorage.setItem(STORAGE_KEY, 'all');
                } catch {
                    // ignore localStorage errors
                }
            }
        }
    }, [schoolBranches, selectedBranchId]);

    // Switching school (Owner) resets branch filter to 'all'
    const prevSchoolIdRef = useRef(effectiveSchoolId);
    useEffect(() => {
        if (prevSchoolIdRef.current !== effectiveSchoolId) {
            prevSchoolIdRef.current = effectiveSchoolId;
            setSelectedBranchIdState('all');
            try {
                localStorage.setItem(STORAGE_KEY, 'all');
            } catch {
                // ignore localStorage errors
            }
        }
    }, [effectiveSchoolId]);

    // Sync across components in the same tab
    const setSelectedBranchId = useCallback((id: string) => {
        setSelectedBranchIdState(id);
        try {
            localStorage.setItem(STORAGE_KEY, id);
            window.dispatchEvent(new CustomEvent('edusync_branch_change', { detail: id }));
        } catch {
            // ignore localStorage errors
        }
    }, []);

    useEffect(() => {
        const handleSync = (e: any) => {
            if (e.detail && e.detail !== selectedBranchId) {
                setSelectedBranchIdState(e.detail);
            }
        };
        window.addEventListener('edusync_branch_change', handleSync);
        return () => window.removeEventListener('edusync_branch_change', handleSync);
    }, [selectedBranchId]);

    const selectedBranchName = useMemo(() => {
        if (!hasMultipleBranches || selectedBranchId === 'all') return 'All branches';
        if (selectedBranchId === 'unassigned') return 'Unassigned';
        const found = schoolBranches.find(b => b.id === selectedBranchId);
        return found ? found.name : 'All branches';
    }, [hasMultipleBranches, selectedBranchId, schoolBranches]);

    // Lookups
    const classBranchMap = useMemo(() => {
        const map = new Map<string, string | null>();
        classes.forEach(c => {
            map.set(c.id, c.branchId || null);
        });
        return map;
    }, [classes]);

    const studentBranchMap = useMemo(() => {
        const map = new Map<string, string | null>();
        students.forEach(s => {
            const bId = s.classId ? classBranchMap.get(s.classId) || null : null;
            map.set(s.id, bId);
        });
        return map;
    }, [students, classBranchMap]);

    // Filter helpers
    const filterClasses = useCallback(<T extends { id?: string; branchId?: string | null }>(items: T[]): T[] => {
        if (!hasMultipleBranches || selectedBranchId === 'all') return items;
        if (selectedBranchId === 'unassigned') return items.filter(c => !c.branchId);
        return items.filter(c => c.branchId === selectedBranchId);
    }, [hasMultipleBranches, selectedBranchId]);

    const filterStudents = useCallback(<T extends { id?: string; classId?: string | null }>(items: T[]): T[] => {
        if (!hasMultipleBranches || selectedBranchId === 'all') return items;
        if (selectedBranchId === 'unassigned') {
            return items.filter(s => {
                if (!s.classId) return true;
                return !classBranchMap.get(s.classId);
            });
        }
        return items.filter(s => {
            if (!s.classId) return false;
            return classBranchMap.get(s.classId) === selectedBranchId;
        });
    }, [hasMultipleBranches, selectedBranchId, classBranchMap]);

    const filterFees = useCallback(<T extends { studentId?: string }>(items: T[]): T[] => {
        if (!hasMultipleBranches || selectedBranchId === 'all') return items;
        if (selectedBranchId === 'unassigned') {
            return items.filter(f => {
                if (!f.studentId) return true;
                return !studentBranchMap.get(f.studentId);
            });
        }
        return items.filter(f => {
            if (!f.studentId) return false;
            return studentBranchMap.get(f.studentId) === selectedBranchId;
        });
    }, [hasMultipleBranches, selectedBranchId, studentBranchMap]);

    const filterAttendance = useCallback(<T extends { studentId?: string; classId?: string }>(items: T[]): T[] => {
        if (!hasMultipleBranches || selectedBranchId === 'all') return items;
        if (selectedBranchId === 'unassigned') {
            return items.filter(a => {
                if (a.classId && classBranchMap.has(a.classId)) {
                    return !classBranchMap.get(a.classId);
                }
                if (a.studentId) {
                    return !studentBranchMap.get(a.studentId);
                }
                return true;
            });
        }
        return items.filter(a => {
            if (a.classId && classBranchMap.has(a.classId)) {
                return classBranchMap.get(a.classId) === selectedBranchId;
            }
            if (a.studentId) {
                return studentBranchMap.get(a.studentId) === selectedBranchId;
            }
            return false;
        });
    }, [hasMultipleBranches, selectedBranchId, classBranchMap, studentBranchMap]);

    const filterResults = useCallback(<T extends { studentId?: string; classId?: string }>(items: T[]): T[] => {
        if (!hasMultipleBranches || selectedBranchId === 'all') return items;
        if (selectedBranchId === 'unassigned') {
            return items.filter(r => {
                if (r.classId && classBranchMap.has(r.classId)) {
                    return !classBranchMap.get(r.classId);
                }
                if (r.studentId) {
                    return !studentBranchMap.get(r.studentId);
                }
                return true;
            });
        }
        return items.filter(r => {
            if (r.classId && classBranchMap.has(r.classId)) {
                return classBranchMap.get(r.classId) === selectedBranchId;
            }
            if (r.studentId) {
                return studentBranchMap.get(r.studentId) === selectedBranchId;
            }
            return false;
        });
    }, [hasMultipleBranches, selectedBranchId, classBranchMap, studentBranchMap]);

    return {
        selectedBranchId,
        setSelectedBranchId,
        branches: schoolBranches,
        hasMultipleBranches,
        hasUnassignedClasses,
        selectedBranchName,
        filterClasses,
        filterStudents,
        filterFees,
        filterAttendance,
        filterResults
    };
}

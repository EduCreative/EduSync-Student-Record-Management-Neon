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
    isLocked: boolean;
    lockedBranchId: string | null;
    filterClasses: <T extends { id?: string; branchId?: string | null }>(items: T[]) => T[];
    filterStudents: <T extends { id?: string; classId?: string | null }>(items: T[]) => T[];
    filterFees: <T extends { studentId?: string }>(items: T[]) => T[];
    filterAttendance: <T extends { studentId?: string; classId?: string }>(items: T[]) => T[];
    filterResults: <T extends { studentId?: string; classId?: string }>(items: T[]) => T[];
}

export function useBranchFilter(): UseBranchFilterResult {
    const { user, activeSchoolId } = useAuth();
    const { branches, classes, students } = useData();

    const isLocked = Boolean(user && user.role !== UserRole.Owner && user.branchId);
    const lockedBranchId = isLocked && user?.branchId ? user.branchId : null;

    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    // Current school's branches (sorted by name)
    const schoolBranches = useMemo(() => {
        const list = effectiveSchoolId
            ? branches.filter(b => b.schoolId === effectiveSchoolId)
            : branches;
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [branches, effectiveSchoolId]);

    const hasMultipleBranches = !isLocked && schoolBranches.length >= 2;

    const schoolClasses = useMemo(() => {
        return effectiveSchoolId
            ? classes.filter(c => c.schoolId === effectiveSchoolId)
            : classes;
    }, [classes, effectiveSchoolId]);

    const hasUnassignedClasses = useMemo(() => {
        if (isLocked) return false;
        return schoolClasses.some(c => !c.branchId);
    }, [schoolClasses, isLocked]);

    const [selectedBranchIdState, setSelectedBranchIdState] = useState<string>(() => {
        if (lockedBranchId) return lockedBranchId;
        try {
            return localStorage.getItem(STORAGE_KEY) || 'all';
        } catch {
            return 'all';
        }
    });

    const selectedBranchId = isLocked && lockedBranchId ? lockedBranchId : selectedBranchIdState;

    // Reset to 'all' if remembered branch no longer exists in current school
    useEffect(() => {
        if (!isLocked && selectedBranchId !== 'all' && selectedBranchId !== 'unassigned') {
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
    }, [schoolBranches, selectedBranchId, isLocked]);

    // Switching school (Owner) resets branch filter to 'all'
    const prevSchoolIdRef = useRef(effectiveSchoolId);
    useEffect(() => {
        if (prevSchoolIdRef.current !== effectiveSchoolId) {
            prevSchoolIdRef.current = effectiveSchoolId;
            if (!isLocked) {
                setSelectedBranchIdState('all');
                try {
                    localStorage.setItem(STORAGE_KEY, 'all');
                } catch {
                    // ignore localStorage errors
                }
            }
        }
    }, [effectiveSchoolId, isLocked]);

    // Sync across components in the same tab
    const setSelectedBranchId = useCallback((id: string) => {
        if (isLocked) return; // Locked staff cannot switch branch view
        setSelectedBranchIdState(id);
        try {
            localStorage.setItem(STORAGE_KEY, id);
            window.dispatchEvent(new CustomEvent('edusync_branch_change', { detail: id }));
        } catch {
            // ignore localStorage errors
        }
    }, [isLocked]);

    useEffect(() => {
        const handleSync = (e: any) => {
            if (!isLocked && e.detail && e.detail !== selectedBranchId) {
                setSelectedBranchIdState(e.detail);
            }
        };
        window.addEventListener('edusync_branch_change', handleSync);
        return () => window.removeEventListener('edusync_branch_change', handleSync);
    }, [selectedBranchId, isLocked]);

    const selectedBranchName = useMemo(() => {
        if (isLocked && lockedBranchId) {
            const found = schoolBranches.find(b => b.id === lockedBranchId);
            return found ? found.name : 'Assigned Branch';
        }
        if (!hasMultipleBranches || selectedBranchId === 'all') return 'All branches';
        if (selectedBranchId === 'unassigned') return 'Unassigned';
        const found = schoolBranches.find(b => b.id === selectedBranchId);
        return found ? found.name : 'All branches';
    }, [hasMultipleBranches, selectedBranchId, schoolBranches, isLocked, lockedBranchId]);

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
        const effectiveId = isLocked ? lockedBranchId : selectedBranchId;
        if (!isLocked && (!hasMultipleBranches || effectiveId === 'all')) return items;
        if (effectiveId === 'unassigned') return items.filter(c => !c.branchId);
        return items.filter(c => c.branchId === effectiveId);
    }, [hasMultipleBranches, selectedBranchId, isLocked, lockedBranchId]);

    const filterStudents = useCallback(<T extends { id?: string; classId?: string | null }>(items: T[]): T[] => {
        const effectiveId = isLocked ? lockedBranchId : selectedBranchId;
        if (!isLocked && (!hasMultipleBranches || effectiveId === 'all')) return items;
        if (effectiveId === 'unassigned') {
            return items.filter(s => {
                if (!s.classId) return true;
                return !classBranchMap.get(s.classId);
            });
        }
        return items.filter(s => {
            if (!s.classId) return false;
            return classBranchMap.get(s.classId) === effectiveId;
        });
    }, [hasMultipleBranches, selectedBranchId, classBranchMap, isLocked, lockedBranchId]);

    const filterFees = useCallback(<T extends { studentId?: string }>(items: T[]): T[] => {
        const effectiveId = isLocked ? lockedBranchId : selectedBranchId;
        if (!isLocked && (!hasMultipleBranches || effectiveId === 'all')) return items;
        if (effectiveId === 'unassigned') {
            return items.filter(f => {
                if (!f.studentId) return true;
                return !studentBranchMap.get(f.studentId);
            });
        }
        return items.filter(f => {
            if (!f.studentId) return false;
            return studentBranchMap.get(f.studentId) === effectiveId;
        });
    }, [hasMultipleBranches, selectedBranchId, studentBranchMap, isLocked, lockedBranchId]);

    const filterAttendance = useCallback(<T extends { studentId?: string; classId?: string }>(items: T[]): T[] => {
        const effectiveId = isLocked ? lockedBranchId : selectedBranchId;
        if (!isLocked && (!hasMultipleBranches || effectiveId === 'all')) return items;
        if (effectiveId === 'unassigned') {
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
                return classBranchMap.get(a.classId) === effectiveId;
            }
            if (a.studentId) {
                return studentBranchMap.get(a.studentId) === effectiveId;
            }
            return false;
        });
    }, [hasMultipleBranches, selectedBranchId, classBranchMap, studentBranchMap, isLocked, lockedBranchId]);

    const filterResults = useCallback(<T extends { studentId?: string; classId?: string }>(items: T[]): T[] => {
        const effectiveId = isLocked ? lockedBranchId : selectedBranchId;
        if (!isLocked && (!hasMultipleBranches || effectiveId === 'all')) return items;
        if (effectiveId === 'unassigned') {
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
                return classBranchMap.get(r.classId) === effectiveId;
            }
            if (r.studentId) {
                return studentBranchMap.get(r.studentId) === effectiveId;
            }
            return false;
        });
    }, [hasMultipleBranches, selectedBranchId, classBranchMap, studentBranchMap, isLocked, lockedBranchId]);

    return {
        selectedBranchId,
        setSelectedBranchId,
        branches: schoolBranches,
        hasMultipleBranches,
        hasUnassignedClasses,
        selectedBranchName,
        isLocked,
        lockedBranchId,
        filterClasses,
        filterStudents,
        filterFees,
        filterAttendance,
        filterResults
    };
}

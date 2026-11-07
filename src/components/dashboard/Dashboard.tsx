


import type { FC } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import AdminDashboard from './AdminDashboard';
import AccountantDashboard from './AccountantDashboard';
import TeacherDashboard from './TeacherDashboard';
import ParentDashboard from './ParentDashboard';
import StudentDashboard from './StudentDashboard';
import { ActiveView } from '../layout/Layout';

interface DashboardProps {
    setActiveView: (view: ActiveView) => void;
}

const Dashboard: FC<DashboardProps> = ({ setActiveView }) => {
    const { user } = useAuth();

    if (!user) {
        return <div className="text-center p-8">Loading user data...</div>;
    }

    switch (user.role) {
        case UserRole.Owner:
        case UserRole.Admin:
            return <AdminDashboard setActiveView={setActiveView} />;
        case UserRole.Accountant:
            return <AccountantDashboard />;
        case UserRole.Teacher:
            return <TeacherDashboard />;
        case UserRole.Parent:
            return <ParentDashboard />;
        case UserRole.Student:
            return <StudentDashboard />;
        default:
            return <div className="text-center p-8">Invalid user role. Please contact support.</div>;
    }
};

export default Dashboard;
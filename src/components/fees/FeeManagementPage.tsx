import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import FeeHeadsManagement from './FeeHeadsManagement';
import FeeCollectionPage from './FeeCollectionPage';
import ChallanGenerationPage from './ChallanGenerationPage';
import FeeRemindersPage from './FeeRemindersPage';
import { Permission } from '../../permissions';


const FeeManagementPage: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState('collection');

    if (!user) return null;
    
    const tabs = [
        { id: 'collection', label: 'Fee Collection', permission: null },
        { id: 'reminders', label: 'Send Reminders', permission: Permission.CAN_SEND_FEE_REMINDERS },
        { id: 'generation', label: 'Challan Generation', permission: Permission.CAN_MANAGE_FEES },
        { id: 'heads', label: 'Fee Heads', permission: Permission.CAN_MANAGE_FEE_HEADS },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Fee Management</h1>
            
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md">
                <div className="border-b border-secondary-200 dark:border-secondary-700">
                    <nav className="-mb-px flex space-x-4 sm:space-x-6 px-2 sm:px-6 overflow-x-auto" aria-label="Tabs">
                        {tabs.map(tab => (
                            (!tab.permission || hasPermission(tab.permission)) && (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`${
                                        activeTab === tab.id
                                            ? 'border-primary-500 text-primary-600'
                                            : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300 dark:text-secondary-400 dark:hover:text-secondary-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    {tab.label}
                                </button>
                            )
                        ))}
                    </nav>
                </div>
                <div>
                    {activeTab === 'collection' && <FeeCollectionPage />}
                    {activeTab === 'reminders' && hasPermission(Permission.CAN_SEND_FEE_REMINDERS) && <FeeRemindersPage />}
                    {activeTab === 'generation' && hasPermission(Permission.CAN_MANAGE_FEES) && <ChallanGenerationPage />}
                    {activeTab === 'heads' && hasPermission(Permission.CAN_MANAGE_FEE_HEADS) && <FeeHeadsManagement />}
                </div>
            </div>
        </div>
    );
};

export default FeeManagementPage;
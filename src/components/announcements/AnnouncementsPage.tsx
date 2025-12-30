
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useNotification } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { UserRole } from '../../types';
import Badge from '../common/Badge';
import { formatDateTime } from '../../constants';

const MegaphoneIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-0.8"/></svg>
);

const AnnouncementsPage: React.FC = () => {
    const { user, hasPermission, effectiveRole, activeSchoolId } = useAuth();
    const { users, students, classes } = useData();
    const { sendAnnouncement, notifications } = useNotification();
    const { showToast } = useToast();

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetRole, setTargetRole] = useState<UserRole | 'All'>('All');
    const [targetClassId, setTargetClassId] = useState<string>('All');
    const [isSending, setIsSending] = useState(false);

    const canSend = hasPermission('CAN_SEND_ANNOUNCEMENTS' as any);
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;

    const schoolClasses = useMemo(() => classes.filter(c => c.schoolId === effectiveSchoolId), [classes, effectiveSchoolId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            showToast('Error', 'Title and message are required.', 'error');
            return;
        }

        setIsSending(true);
        try {
            let targetUsers = users.filter(u => u.schoolId === effectiveSchoolId);

            if (targetRole !== 'All') {
                targetUsers = targetUsers.filter(u => u.role === targetRole);
            }

            if (targetClassId !== 'All') {
                // Find all student user IDs and parent user IDs associated with this class
                const classStudents = students.filter(s => s.classId === targetClassId);
                const classUserIds = new Set<string>();
                
                classStudents.forEach(s => {
                    if (s.userId) classUserIds.add(s.userId);
                    // For parents, we need to find the parent user linked to the student
                    // Current schema: student.userId is either student account OR parent account.
                    // Assuming parents are linked via student.userId for notifications
                });
                
                targetUsers = targetUsers.filter(u => classUserIds.has(u.id));
            }

            const userIds = targetUsers.map(u => u.id);
            
            if (userIds.length === 0) {
                showToast('Info', 'No users match your criteria.', 'info');
            } else {
                await sendAnnouncement(userIds, title, message);
                showToast('Success', `Announcement sent to ${userIds.length} users.`, 'success');
                setTitle('');
                setMessage('');
            }
        } catch (error) {
            showToast('Error', 'Failed to send announcement.', 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-secondary-900 dark:text-white flex items-center gap-3">
                    <MegaphoneIcon className="w-8 h-8 text-primary-600" />
                    Announcements
                </h1>
            </div>

            {canSend && (
                <div className="bg-white dark:bg-secondary-800 rounded-2xl shadow-xl p-6 border border-secondary-200 dark:border-secondary-700">
                    <h2 className="text-xl font-bold mb-6">Broadcast New Message</h2>
                    <form onSubmit={handleSend} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="input-label">Target Role</label>
                                <select 
                                    value={targetRole} 
                                    onChange={e => setTargetRole(e.target.value as any)}
                                    className="input-field"
                                >
                                    <option value="All">All Roles</option>
                                    <option value={UserRole.Teacher}>Teachers Only</option>
                                    <option value={UserRole.Parent}>Parents Only</option>
                                    <option value={UserRole.Student}>Students Only</option>
                                </select>
                            </div>
                            <div>
                                <label className="input-label">Target Class (Optional)</label>
                                <select 
                                    value={targetClassId} 
                                    onChange={e => setTargetClassId(e.target.value)}
                                    className="input-field"
                                    disabled={targetRole !== 'All' && targetRole !== UserRole.Parent && targetRole !== UserRole.Student}
                                >
                                    <option value="All">All Classes</option>
                                    {schoolClasses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} {c.section || ''}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="input-label">Announcement Title</label>
                            <input 
                                type="text" 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="input-field" 
                                placeholder="e.g., School Closure Notice"
                                required 
                            />
                        </div>

                        <div>
                            <label className="input-label">Message Body</label>
                            <textarea 
                                value={message} 
                                onChange={e => setMessage(e.target.value)} 
                                className="input-field min-h-[120px]" 
                                placeholder="Type your announcement here..."
                                required 
                            />
                        </div>

                        <div className="flex justify-end">
                            <button 
                                type="submit" 
                                disabled={isSending}
                                className="btn-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                            >
                                {isSending ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <MegaphoneIcon className="w-5 h-5" />
                                )}
                                Send Announcement
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-4">
                <h2 className="text-xl font-bold text-secondary-900 dark:text-white">Recent Messages</h2>
                <div className="grid grid-cols-1 gap-4">
                    {notifications.length > 0 ? (
                        notifications.map((n) => (
                            <div key={n.id} className={`bg-white dark:bg-secondary-800 p-6 rounded-xl shadow-md border-l-4 ${!n.isRead ? 'border-primary-500 bg-primary-50/10' : 'border-secondary-300 dark:border-secondary-600'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg">{n.title}</h3>
                                    {!n.isRead && <Badge color="primary">New</Badge>}
                                </div>
                                <p className="text-secondary-600 dark:text-secondary-400 text-sm whitespace-pre-wrap">{n.message}</p>
                                <div className="mt-4 pt-4 border-t dark:border-secondary-700 flex justify-between items-center text-[10px] uppercase font-bold text-secondary-400 tracking-wider">
                                    <span>{formatDateTime(n.timestamp)}</span>
                                    <span>School Announcement</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-secondary-800 rounded-xl border-2 border-dashed border-secondary-200 dark:border-secondary-700">
                            <p className="text-secondary-500">No announcements found in your inbox.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnnouncementsPage;

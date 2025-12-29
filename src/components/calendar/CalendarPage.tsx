
import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { SchoolEvent, UserRole } from '../../types';
import EventFormModal from './EventFormModal';
import Modal from '../common/Modal';

const CalendarPage: React.FC = () => {
    const { user, effectiveRole, activeSchoolId } = useAuth();
    const { events, addEvent, updateEvent, deleteEvent } = useData();
    const [currentDate, setCurrentDate] = useState(new Date());
    
    // State for modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<SchoolEvent | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [eventToDelete, setEventToDelete] = useState<SchoolEvent | null>(null);

    const isAdmin = effectiveRole === UserRole.Admin || effectiveRole === UserRole.Owner;
    const effectiveSchoolId = user?.role === UserRole.Owner && activeSchoolId ? activeSchoolId : user?.schoolId;
    
    const schoolEvents = useMemo(() => {
        return events.filter(e => e.schoolId === effectiveSchoolId);
    }, [events, effectiveSchoolId]);

    const eventsByDate = useMemo(() => schoolEvents.reduce((acc, event) => {
        const date = event.date;
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(event);
        return acc;
    }, {} as Record<string, SchoolEvent[]>), [schoolEvents]);

    // Calendar grid generation logic
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startOfMonth.getDay());
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endOfMonth.getDay()));

    const days = [];
    let day = startDate;
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    // Handlers
    const handleDayClick = (date: Date) => {
        if (!isAdmin) return;
        setSelectedDate(date.toISOString().split('T')[0]);
        setEventToEdit(null);
        setIsModalOpen(true);
    };

    const handleEventClick = (event: SchoolEvent, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent day click from firing
        setSelectedDate(null);
        setEventToEdit(event);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEventToEdit(null);
        setSelectedDate(null);
    };

    const handleSaveEvent = async (eventData: Omit<SchoolEvent, 'id' | 'schoolId'> | SchoolEvent) => {
        if (!effectiveSchoolId) return;

        if ('id' in eventData) {
            await updateEvent(eventData);
        } else {
            await addEvent({ ...eventData, schoolId: effectiveSchoolId });
        }
    };

    const handleDeleteRequest = (eventId: string) => {
        const event = schoolEvents.find(e => e.id === eventId);
        if (event) {
            setEventToDelete(event);
            setIsModalOpen(false); // Close form modal first
        }
    };

    const confirmDelete = () => {
        if (eventToDelete) {
            deleteEvent(eventToDelete.id);
            setEventToDelete(null);
        }
    };

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const getCategoryColor = (category: SchoolEvent['category']) => {
        const colors = {
            Holiday: 'bg-red-500 hover:bg-red-600',
            Exam: 'bg-yellow-500 hover:bg-yellow-600',
            Event: 'bg-green-500 hover:bg-green-600',
            Meeting: 'bg-blue-500 hover:bg-blue-600'
        };
        return colors[category] || 'bg-secondary-500 hover:bg-secondary-600';
    };

    return (
        <>
            <EventFormModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveEvent}
                onDelete={handleDeleteRequest}
                eventToEdit={eventToEdit}
                selectedDate={selectedDate || undefined}
                isReadOnly={!isAdmin}
            />
             <Modal isOpen={!!eventToDelete} onClose={() => setEventToDelete(null)} title="Confirm Event Deletion">
                <div>
                    <p>Are you sure you want to delete the event "{eventToDelete?.title}"?</p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={() => setEventToDelete(null)} className="btn-secondary">Cancel</button>
                        <button onClick={confirmDelete} className="btn-danger">Delete</button>
                    </div>
                </div>
            </Modal>

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">School Calendar</h1>
                    {isAdmin && <button onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setEventToEdit(null); setIsModalOpen(true); }} className="btn-primary">+ Add Event</button>}
                </div>

                <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-4">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-700">&lt;</button>
                        <h2 className="text-xl font-semibold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-secondary-100 dark:hover:bg-secondary-700">&gt;</button>
                    </div>

                    <div className="grid grid-cols-7 border-t border-l border-secondary-200 dark:border-secondary-700">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="text-center py-2 bg-secondary-50 dark:bg-secondary-900 font-medium text-sm border-r border-b dark:border-secondary-700">{day}</div>
                        ))}
                        {days.map(d => {
                            const dateStr = d.toISOString().split('T')[0];
                            const dayEvents = eventsByDate[dateStr] || [];
                            const isToday = new Date().toISOString().split('T')[0] === dateStr;
                            const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                            return (
                                <div 
                                    key={dateStr} 
                                    className={`p-1 h-32 flex flex-col border-r border-b dark:border-secondary-700 ${isCurrentMonth ? 'bg-white dark:bg-secondary-800' : 'bg-secondary-50 dark:bg-secondary-900/50'} ${isAdmin ? 'cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-700/50' : ''}`}
                                    onClick={() => handleDayClick(d)}
                                >
                                    <span className={`self-start text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-primary-600 text-white' : ''}`}>
                                        {d.getDate()}
                                    </span>
                                    <div className="flex-1 overflow-y-auto space-y-1 mt-1 text-xs">
                                        {dayEvents.map(event => (
                                            <div key={event.id} onClick={(e) => handleEventClick(event, e)} className={`p-1 rounded text-white text-left truncate cursor-pointer transition-colors ${getCategoryColor(event.category)}`}>
                                                {event.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CalendarPage;
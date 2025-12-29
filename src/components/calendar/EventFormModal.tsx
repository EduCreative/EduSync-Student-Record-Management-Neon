import React, { useState, useEffect } from 'react';
import { SchoolEvent } from '../../types';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';

interface EventFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: Omit<SchoolEvent, 'id' | 'schoolId'> | SchoolEvent) => Promise<void>;
    onDelete: (eventId: string) => void;
    eventToEdit?: SchoolEvent | null;
    selectedDate?: string;
    isReadOnly?: boolean;
}

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const EventFormModal: React.FC<EventFormModalProps> = ({ isOpen, onClose, onSave, onDelete, eventToEdit, selectedDate, isReadOnly = false }) => {
    const { showToast } = useToast();
    const getInitialFormData = () => ({
        title: '',
        date: selectedDate || getTodayString(),
        category: 'Event' as SchoolEvent['category'],
        description: '',
    });
    
    const [formData, setFormData] = useState(getInitialFormData());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                setFormData({
                    title: eventToEdit.title,
                    date: eventToEdit.date,
                    category: eventToEdit.category,
                    description: eventToEdit.description || '',
                });
            } else {
                setFormData(getInitialFormData());
            }
        }
    }, [eventToEdit, selectedDate, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !formData.title.trim()) return;
        
        setIsSaving(true);
        try {
            if (eventToEdit) {
                await onSave({ ...eventToEdit, ...formData });
            } else {
                await onSave(formData);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save event:", error);
            showToast('Error', 'An error occurred while saving the event.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (eventToEdit && !isReadOnly) {
            onDelete(eventToEdit.id);
        }
    };

    const title = isReadOnly ? "View Event" : (eventToEdit ? "Edit Event" : "Add New Event");
    const categories: SchoolEvent['category'][] = ['Event', 'Holiday', 'Exam', 'Meeting'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="title" className="input-label">Event Title</label>
                    <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} className="input-field" required disabled={isReadOnly} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="date" className="input-label">Date</label>
                        <input type="date" name="date" id="date" value={formData.date} onChange={handleChange} className="input-field" required disabled={isReadOnly} />
                    </div>
                     <div>
                        <label htmlFor="category" className="input-label">Category</label>
                        <select name="category" id="category" value={formData.category} onChange={handleChange} className="input-field" disabled={isReadOnly}>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>
                 <div>
                    <label htmlFor="description" className="input-label">Description (Optional)</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="input-field" disabled={isReadOnly} />
                </div>

                <div className="flex justify-between items-center pt-4">
                    <div>
                        {eventToEdit && !isReadOnly && (
                            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <button type="button" onClick={onClose} className="btn-secondary">Close</button>
                        {!isReadOnly && <button type="submit" className="btn-primary" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Event'}
                        </button>}
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default EventFormModal;
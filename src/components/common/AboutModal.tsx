import React from 'react';
import Modal from './Modal';
import { EduSyncLogo } from '../../constants';
import { version } from '../../../package.json';
import metadata from '../../../metadata.json';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="About EduSync">
            <div className="text-center p-4">
                <EduSyncLogo className="w-16 h-16 text-primary-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-secondary-900 dark:text-white">
                    EduSync
                </h2>
                <p className="text-sm text-secondary-500">Version {version}</p>
                <p className="mt-4 text-secondary-600 dark:text-secondary-400 max-w-md mx-auto">
                    {metadata.description}
                </p>

                <div className="mt-6 border-t dark:border-secondary-700 pt-4">
                    <h3 className="font-semibold text-secondary-800 dark:text-secondary-200">Contact Information</h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-2">
                        For support or inquiries, please contact:
                    </p>
                    <div className="mt-2 flex flex-col sm:flex-row sm:justify-center sm:space-x-4 space-y-2 sm:space-y-0 text-sm">
                        <a href="mailto:kmasroor50@gmail.com" className="text-primary-600 hover:underline">
                            kmasroor50@gmail.com
                        </a>
                        <a href="tel:+923331306603" className="text-primary-600 hover:underline">
                            +92 333 1306603 (WhatsApp)
                        </a>
                    </div>
                </div>

                <p className="mt-6 text-xs text-secondary-400">
                    &copy; {new Date().getFullYear()} EduSync. All rights reserved.
                </p>
            </div>
        </Modal>
    );
};

export default AboutModal;
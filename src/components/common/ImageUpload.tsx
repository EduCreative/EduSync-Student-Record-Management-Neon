
import React, { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';

interface ImageUploadProps {
  imageUrl: string | null | undefined;
  onChange: (url: string) => void;
  bucketName?: 'avatars' | 'logos';
}

const compressImageToBase64 = (file: File, quality = 0.6, maxWidth = 400, maxHeight = 400): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let { width, height } = img;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Failed to get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);

                const base64 = canvas.toDataURL('image/jpeg', quality);
                resolve(base64);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};


const ImageUpload: React.FC<ImageUploadProps> = ({ imageUrl, onChange, bucketName = 'avatars' }) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                return;
            }

            const originalFile = event.target.files[0];
            
            // For logos, we might want slightly higher quality or different dimensions
            const isLogo = bucketName === 'logos';
            const base64 = await compressImageToBase64(
                originalFile, 
                isLogo ? 0.8 : 0.6, 
                isLogo ? 600 : 300, 
                isLogo ? 600 : 300
            );
            
            onChange(base64);
            showToast('Success', 'Image processed successfully.');

        } catch (error: any) {
            showToast('Upload Error', error.message || 'Image processing failed.', 'error');
        } finally {
            setUploading(false);
        }
    };
    
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };
    
    const placeholder = bucketName === 'logos'
        ? <BuildingIcon className="w-12 h-12 text-secondary-400" />
        : <UserIcon className="w-12 h-12 text-secondary-400" />;

    return (
        <div className="flex flex-col items-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-secondary-200 dark:bg-secondary-700 flex items-center justify-center overflow-hidden border-2 border-secondary-300 dark:border-secondary-600">
                {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                    placeholder
                )}
            </div>
            <button
                type="button"
                onClick={triggerFileInput}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-secondary-700 bg-secondary-100 hover:bg-secondary-200 dark:bg-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-600 rounded-lg disabled:opacity-50 transition-all border border-secondary-300 dark:border-secondary-500 shadow-sm"
            >
                {uploading ? 'Processing...' : (bucketName === 'logos' ? 'Upload Logo' : 'Upload Photo')}
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
            />
        </div>
    );
};

const UserIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

const BuildingIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
    </svg>
);

export default ImageUpload;

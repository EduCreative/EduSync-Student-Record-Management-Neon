import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

interface ImageUploadProps {
  imageUrl: string | null | undefined;
  onChange: (url: string) => void;
  bucketName?: 'avatars' | 'logos';
}

const compressImage = (file: File, quality = 0.7, maxWidth = 1024, maxHeight = 1024): Promise<File> => {
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

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return reject(new Error('Image compression failed.'));
                        }
                        const outputFileName = file.name.replace(/\.[^/.]+$/, ".jpeg");
                        const newFile = new File([blob], outputFileName, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    },
                    'image/jpeg',
                    quality
                );
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
        let filePath = '';
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }

            const originalFile = event.target.files[0];
            const file = await compressImage(originalFile);
            
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            filePath = `${fileName}`;

            // Create a timeout promise to reject after 30 seconds
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Upload timed out. Please check your connection.")), 30000)
            );

            // Execute the upload operation or timeout
            const uploadPromise = supabase.storage.from(bucketName).upload(filePath, file);
            
            const { data: uploadData, error: uploadError } = await Promise.race([
                uploadPromise, 
                timeoutPromise
            ]) as any;

            if (uploadError) {
                throw uploadError;
            }

            if (!uploadData) {
                throw new Error("Upload completed but no data was returned from Supabase.");
            }

            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            
            if (!publicUrlData.publicUrl) {
                // Attempt to remove the uploaded file if we can't get a URL, to avoid orphans.
                await supabase.storage.from(bucketName).remove([filePath]);
                throw new Error('Could not get public URL for the uploaded image.');
            }
            
            onChange(publicUrlData.publicUrl);
            showToast('Success', 'Image uploaded successfully.');

        } catch (error: any) {
            // If an error occurred and a file was potentially uploaded, try to clean it up.
            if (filePath) {
                try {
                    await supabase.storage.from(bucketName).remove([filePath]);
                } catch (e) {
                    console.error("Failed to cleanup file after error:", e);
                }
            }
            showToast('Upload Error', error.message || 'Image upload failed.', 'error');
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
            <div className="w-24 h-24 rounded-full bg-secondary-200 dark:bg-secondary-700 flex items-center justify-center overflow-hidden">
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
                className="px-4 py-2 text-sm font-medium text-secondary-700 bg-secondary-100 hover:bg-secondary-200 dark:bg-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-600 rounded-lg disabled:opacity-50"
            >
                {uploading ? 'Uploading...' : (bucketName === 'logos' ? 'Upload Logo' : 'Upload Photo')}
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

/**
 * Utility for Google Drive Backup/Restore
 * Requires VITE_GOOGLE_CLIENT_ID environment variable
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export interface DriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}

class GoogleDriveService {
    private tokenClient: any = null;
    private accessToken: string | null = null;

    init() {
        return new Promise<void>((resolve, reject) => {
            if (this.tokenClient) return resolve();
            
            if (!(window as any).google) {
                return reject(new Error('Google Identity Services script not loaded.'));
            }

            try {
                this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response: any) => {
                        if (response.error) {
                            reject(response);
                        } else {
                            this.accessToken = response.access_token;
                            resolve();
                        }
                    },
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    async getAccessToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.accessToken) {
                return resolve(this.accessToken);
            }

            this.init().then(() => {
                this.tokenClient.requestAccessToken({ prompt: 'consent' });
                // The resolve happens in the callback of initTokenClient
                const checkInterval = setInterval(() => {
                    if (this.accessToken) {
                        clearInterval(checkInterval);
                        resolve(this.accessToken);
                    }
                }, 500);
            }).catch(reject);
        });
    }

    async uploadFile(fileName: string, content: string): Promise<void> {
        const token = await this.getAccessToken();
        
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
    }

    async listBackups(): Promise<DriveFile[]> {
        const token = await this.getAccessToken();
        const response = await fetch(
            'https://www.googleapis.com/drive/v3/files?q=mimeType="application/json" and trashed=false&fields=files(id, name, modifiedTime)',
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to list files: ${response.statusText}`);
        }

        const data = await response.json();
        return data.files.filter((f: any) => f.name.startsWith('edusync_backup_'));
    }

    async downloadFile(fileId: string): Promise<string> {
        const token = await this.getAccessToken();
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }

        return await response.text();
    }
}

export const driveService = new GoogleDriveService();

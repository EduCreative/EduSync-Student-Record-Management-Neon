import React, { useState } from 'react';
import { Key, Lock, Calendar, ShieldCheck, Copy, Check, Info, FileCode } from 'lucide-react';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
);

export const GitHubBackupCard: React.FC = () => {
    const [copiedSec, setCopiedSec] = useState<string | null>(null);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSec(label);
        setTimeout(() => setCopiedSec(null), 2000);
    };

    const decryptCmd = `openssl enc -d -aes-256-cbc -pbkdf2 -in edusync-20261112.json.enc -out backup.json -pass pass:YOUR_PASSPHRASE`;

    return (
        <div className="bg-white dark:bg-secondary-800 rounded-lg shadow-md p-6 mt-6">
            <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full">
                    <GithubIcon className="w-8 h-8 text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-secondary-900 dark:text-white leading-tight">Automated GitHub Actions Backup</h2>
                    <p className="text-sm text-secondary-500 mt-1 max-w-lg">
                        Schedule automated weekly database backups stored as encrypted private build artifacts inside your GitHub repository.
                    </p>
                </div>
            </div>

            <div className="bg-secondary-50 dark:bg-secondary-900/40 rounded-xl p-5 border dark:border-secondary-700 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg border dark:border-secondary-700">
                        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-sm mb-1">
                            <Calendar className="w-4 h-4" />
                            Automated Weekly Schedule
                        </div>
                        <p className="text-xs text-secondary-600 dark:text-secondary-300">
                            Runs automatically every Sunday at 00:00 UTC (<code className="font-mono bg-secondary-100 dark:bg-secondary-900 px-1 py-0.5 rounded text-[11px]">0 0 * * 0</code>).
                        </p>
                    </div>

                    <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg border dark:border-secondary-700">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1">
                            <Lock className="w-4 h-4" />
                            AES-256 Passphrase Encryption
                        </div>
                        <p className="text-xs text-secondary-600 dark:text-secondary-300">
                            Optional passphrase encryption ensures backup files are secured before stored as repository artifacts.
                        </p>
                    </div>

                    <div className="p-4 bg-white dark:bg-secondary-800 rounded-lg border dark:border-secondary-700">
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm mb-1">
                            <ShieldCheck className="w-4 h-4" />
                            90-Day Private Retention
                        </div>
                        <p className="text-xs text-secondary-600 dark:text-secondary-300">
                            Artifacts are retained securely in your private repository for 90 days and can be downloaded anytime.
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border dark:border-secondary-700 space-y-3">
                    <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-primary-500" />
                        Required GitHub Repository Secrets
                    </h3>
                    <p className="text-xs text-secondary-600 dark:text-secondary-300">
                        Open your repository on GitHub and go to <strong>Settings &gt; Secrets and variables &gt; Actions &gt; New repository secret</strong>:
                    </p>

                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 bg-secondary-50 dark:bg-secondary-900/60 rounded border dark:border-secondary-700 font-mono">
                            <div>
                                <span className="font-bold text-primary-600 dark:text-primary-400">DATABASE_URL</span>
                                <span className="text-secondary-400 text-[11px] block font-sans">Required. Your PostgreSQL database connection string.</span>
                            </div>
                            <button
                                onClick={() => handleCopy('DATABASE_URL', 'db_url')}
                                className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-800 rounded transition-colors text-secondary-500"
                                title="Copy secret name"
                            >
                                {copiedSec === 'db_url' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-secondary-50 dark:bg-secondary-900/60 rounded border dark:border-secondary-700 font-mono">
                            <div>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">BACKUP_PASSPHRASE</span>
                                <span className="text-secondary-400 text-[11px] block font-sans">Optional. Secret key used to encrypt the backup JSON file with OpenSSL AES-256.</span>
                            </div>
                            <button
                                onClick={() => handleCopy('BACKUP_PASSPHRASE', 'passphrase')}
                                className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-800 rounded transition-colors text-secondary-500"
                                title="Copy secret name"
                            >
                                {copiedSec === 'passphrase' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-secondary-800 p-4 rounded-lg border dark:border-secondary-700 space-y-2">
                    <h3 className="text-xs font-bold text-secondary-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileCode className="w-4 h-4 text-secondary-500" />
                        Decrypting Encrypted Backup Artifacts
                    </h3>
                    <p className="text-xs text-secondary-600 dark:text-secondary-300">
                        If <code className="font-mono bg-secondary-100 dark:bg-secondary-900 px-1 py-0.5 rounded">BACKUP_PASSPHRASE</code> is set, download the <code className="font-mono">.json.enc</code> artifact and run this command in terminal:
                    </p>
                    <div className="flex items-center justify-between p-2.5 bg-secondary-900 text-emerald-400 rounded font-mono text-xs overflow-x-auto">
                        <code>{decryptCmd}</code>
                        <button
                            onClick={() => handleCopy(decryptCmd, 'decrypt_cmd')}
                            className="ml-2 p-1.5 hover:bg-secondary-800 rounded transition-colors text-secondary-400 shrink-0"
                            title="Copy decryption command"
                        >
                            {copiedSec === 'decrypt_cmd' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p>
                        <strong>GitHub Inactivity Rule:</strong> GitHub automatically pauses scheduled workflows if a repository has no activity for 60 days. To resume or run an instant backup at any time, open your repository on GitHub, go to <strong>Actions &gt; Scheduled Database Backup &gt; Run workflow</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
};

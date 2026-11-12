import React from 'react';
import { School } from '../../types';
import { EduSyncLogo, formatDate } from '../../constants';

interface PrintableReportLayoutProps {
    school: School | null | undefined;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

const PrintableReportLayout: React.FC<PrintableReportLayoutProps> = ({ school, title, subtitle, children }) => {
    return (
        <div className="printable-report">
            <table className="w-full printable-layout-table">
                <thead>
                    <tr>
                        <td>
                            <div className="page-header-content">
                                <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                                    <div className="flex items-center gap-3 text-left">
                                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center">
                                            {school?.logoUrl ? (
                                                <img src={school.logoUrl} alt="School Logo" className="max-h-10 max-w-10 h-10 w-10 object-contain rounded" />
                                            ) : (
                                                <EduSyncLogo className="h-8 w-8 text-primary-700" />
                                            )}
                                        </div>
                                        <div>
                                            <h1 className="text-xl font-bold">{school?.name}</h1>
                                            <p className="text-xs">{school?.address}</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs">
                                        <span>Generated on: {formatDate(new Date())}</span>
                                    </div>
                                </div>
                                <div className="text-center mt-3">
                                    <h2 className="text-xl font-bold">{title}</h2>
                                    {subtitle && <p className="text-sm mt-0.5">{subtitle}</p>}
                                </div>
                            </div>
                        </td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div className="page-content">
                                {children}
                            </div>
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td>
                            <div className="page-footer-content">
                                <div className="text-xs flex justify-between items-center pt-2 border-t">
                                    <span>Generated on: {formatDate(new Date())}</span>
                                    <span className="page-number">Page </span>
                                </div>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default PrintableReportLayout;
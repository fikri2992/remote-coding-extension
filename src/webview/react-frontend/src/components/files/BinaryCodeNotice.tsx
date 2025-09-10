import React from 'react';
import { cn } from '@/lib/utils';

interface BinaryCodeNoticeProps {
    fileSize: number;
    className?: string;
}

const BinaryCodeNotice: React.FC<BinaryCodeNoticeProps> = ({
    fileSize,
    className
}) => {
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-8 text-center",
            className
        )}>
            <div className="text-6xl mb-4">🖼️</div>
            <h3 className="text-lg font-medium mb-2">Binary Image File</h3>
            <p className="text-muted-foreground mb-4">
                This is a binary image file ({formatFileSize(fileSize)}).
                Use the Download button to save or inspect the file externally.
            </p>
        </div>
    );
};

export default BinaryCodeNotice;

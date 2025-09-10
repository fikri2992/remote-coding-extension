import React from 'react';
import { cn } from '@/lib/utils';

interface ImageErrorBoundaryProps {
    error: string;
    fileSize?: number;
    onDownload?: () => void;
    className?: string;
}

const ImageErrorBoundary: React.FC<ImageErrorBoundaryProps> = ({
    error,
    fileSize,
    onDownload,
    className
}) => {
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const isTooLarge = error.includes('TOO_LARGE') || error.includes('too large for inline viewing');

    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-8 text-center border border-border rounded-lg",
            className
        )}>
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium mb-2">
                {isTooLarge ? 'File Too Large' : 'Image Load Error'}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
                {isTooLarge
                    ? `This image file (${formatFileSize(fileSize || 0)}) exceeds the size limit for inline viewing.`
                    : error
                }
            </p>
            {onDownload && (
                <button
                    onClick={onDownload}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                    Download File
                </button>
            )}
        </div>
    );
};

export default ImageErrorBoundary;

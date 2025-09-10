import React from 'react';
import { cn } from '@/lib/utils';

interface MediaTabsProps {
    activeTab: 'preview' | 'code';
    onTabChange: (tab: 'preview' | 'code') => void;
    className?: string;
}

const MediaTabs: React.FC<MediaTabsProps> = ({
    activeTab,
    onTabChange,
    className
}) => {
    return (
        <div className={cn("flex items-center gap-1", className)}>
            <button
                onClick={() => onTabChange('preview')}
                className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    activeTab === 'preview'
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                )}
                aria-pressed={activeTab === 'preview'}
                aria-label="Show image preview"
            >
                Preview
            </button>
            <button
                onClick={() => onTabChange('code')}
                className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    activeTab === 'code'
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                )}
                aria-pressed={activeTab === 'code'}
                aria-label="Show image code"
            >
                Code
            </button>
        </div>
    );
};

export default MediaTabs;

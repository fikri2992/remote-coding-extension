import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
    src: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
    src,
    alt,
    className,
    onLoad,
    onError
}) => {
    const imgRef = useRef<HTMLImageElement>(null);

    return (
        <div className={cn("flex items-center justify-center p-4 bg-muted/20", className)}>
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onLoad={onLoad}
                onError={onError}
                style={{
                    imageRendering: 'auto',
                    imageOrientation: 'from-image'
                }}
            />
        </div>
    );
};

export default ImagePreview;

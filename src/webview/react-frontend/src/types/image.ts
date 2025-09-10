export interface ImageFileData {
    path: string;
    size: number;
    contentType: string;
    base64?: string; // For raster images
    content?: string; // For SVG (text)
    encoding: 'utf8' | 'base64';
    truncated?: boolean;
}

export interface ImagePreviewState {
    mediaView: 'preview' | 'code';
    blobUrl?: string;
    isLoading: boolean;
    error?: string;
}

export type ImageExtension = 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'ico' | 'svg';

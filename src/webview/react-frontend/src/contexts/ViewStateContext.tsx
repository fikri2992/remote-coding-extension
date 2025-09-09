import React, { createContext, useContext, useMemo, useRef } from 'react';

type Crumb = { name: string; path: string };
type FileNodeLike = { name: string; path: string; type: 'file' | 'directory'; depth?: number };

export interface FilesPageState {
  nodes: FileNodeLike[];
  crumbs: Crumb[];
  scrollY?: number;
  lastLoadedAt?: number;
}

export interface FileViewerState {
  content: string;
  meta?: { path?: string; size?: number; truncated?: boolean };
  scrollY?: number;
  lastLoadedAt?: number;
}

interface ViewStateContextType {
  getFilesState: (path: string) => FilesPageState | undefined;
  setFilesState: (path: string, state: FilesPageState) => void;
  getFileState: (path: string) => FileViewerState | undefined;
  setFileState: (path: string, state: FileViewerState) => void;
  clear: () => void;
}

const ViewStateContext = createContext<ViewStateContextType | undefined>(undefined);

export const useViewState = () => {
  const ctx = useContext(ViewStateContext);
  if (!ctx) throw new Error('useViewState must be used within ViewStateProvider');
  return ctx;
};

export const ViewStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const filesMapRef = useRef(new Map<string, FilesPageState>());
  const fileMapRef = useRef(new Map<string, FileViewerState>());

  const value = useMemo<ViewStateContextType>(() => ({
    getFilesState: (path: string) => filesMapRef.current.get(path),
    setFilesState: (path: string, state: FilesPageState) => {
      filesMapRef.current.set(path, { ...state, lastLoadedAt: Date.now() });
    },
    getFileState: (path: string) => fileMapRef.current.get(path),
    setFileState: (path: string, state: FileViewerState) => {
      fileMapRef.current.set(path, { ...state, lastLoadedAt: Date.now() });
    },
    clear: () => {
      filesMapRef.current.clear();
      fileMapRef.current.clear();
    },
  }), []);

  return (
    <ViewStateContext.Provider value={value}>
      {children}
    </ViewStateContext.Provider>
  );
};


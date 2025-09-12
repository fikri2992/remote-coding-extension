declare module 'vscode' {
  export interface ExtensionContext {
    [key: string]: any;
  }
  export const workspace: {
    getConfiguration: (section?: string) => any;
  };
}

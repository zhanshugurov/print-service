export { };

declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<
        | { updateAvailable: boolean; info?: any }
        | { error: string }
      >;
    };
  }
}

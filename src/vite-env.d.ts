/// <reference types="vite/client" />

interface SaveFilePickerOptions {
  /** Id stabile per ricordare l'ultima directory usata (File System Access API). */
  id?: string
}

interface Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions & {
      suggestedName?: string
      types?: Array<{
        description?: string
        accept: Record<string, string[]>
      }>
    },
  ) => Promise<FileSystemFileHandle>
}

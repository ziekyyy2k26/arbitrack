declare global {
  interface Window {
    AndroidBridge?: {
      saveFile?: (filename: string, mimeType: string, content: string) => boolean;
    };
  }
}

/**
 * Triggers a reliable one-click file download.
 * Uses the native AndroidBridge when running inside the Android APK,
 * and falls back to DOM-attached Blob anchor download in web browsers.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  if (typeof window !== 'undefined' && typeof window.AndroidBridge?.saveFile === 'function') {
    const saved = window.AndroidBridge.saveFile(filename, mimeType, content);
    if (saved) return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

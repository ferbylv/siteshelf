import { handleVaultMessage } from '../lib/vault/runtime';

export default defineBackground(() => {
  // Popup handles 保藏; side panel is the library.
  // Do not set openPanelOnActionClick — a default_popup takes priority.
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const typed = msg as { type?: string };
    void (async () => {
      try {
        const result = await handleVaultMessage(typed, sender);
        sendResponse(result);
      } catch {
        sendResponse({ error: true });
      }
    })();
    return true;
  });
});

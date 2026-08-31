import { handleVaultMessage } from '../lib/vault/runtime';
import { dismissPending, syncPendingBadge } from '../lib/vault/service';

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

  browser.tabs.onRemoved.addListener((tabId) => {
    void dismissPending(tabId);
  });
  browser.tabs.onActivated.addListener((info) => {
    void syncPendingBadge(info.tabId);
  });
  browser.windows.onFocusChanged.addListener(() => {
    void syncPendingBadge();
  });
  void syncPendingBadge();
});

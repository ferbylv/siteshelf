type SidePanelApi = {
  open: (options: { windowId: number }) => Promise<void>;
};

function getSidePanelApi(): SidePanelApi | undefined {
  const fromBrowser = (browser as { sidePanel?: SidePanelApi }).sidePanel;
  if (fromBrowser) return fromBrowser;
  const fromChrome = (globalThis as { chrome?: { sidePanel?: SidePanelApi } }).chrome
    ?.sidePanel;
  return fromChrome;
}

export async function openLibraryPanel(): Promise<void> {
  const win = await browser.windows.getCurrent();
  if (win.id == null) return;
  const api = getSidePanelApi();
  if (!api) {
    throw new Error('当前浏览器不支持侧边栏');
  }
  await api.open({ windowId: win.id });
}

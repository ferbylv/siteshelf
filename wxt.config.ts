import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'SiteShelf 页架',
    short_name: '页架',
    description:
      '保藏网页并生成本地分类；另含本机加密保险库与精确主机自动填充。',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['https://*/*', 'http://*/*'],
  },
});

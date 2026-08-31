import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'SiteShelf 页架',
    short_name: '页架',
    description:
      '保藏网页并生成中文摘要与分类。仅保存公开元数据，不含密码管理。',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
  },
});

/**
 * @see https://theme-plume.vuejs.press/config/navigation/ 查看文档了解配置详情
 *
 * Navbar 配置文件，它在 `.vuepress/plume.config.ts` 中被导入。
 */

import { defineNavbarConfig } from 'vuepress-theme-plume'

export default defineNavbarConfig([
  { text: "首页", link: "/" },
  { text: "博客", link: "/blog/" },
  { text: "分类", link: "/article/categories/" },
  { text: "标签", link: "/article/tags/" },
  { text: "归档", link: "/article/archives/" },
  {
    text: "笔记",
    items: [
      { text: "随手记", link: "/notes/casually.md" },
      { text: "Docker", link: "/notes/docker.md" },
      { text: "KMS", link: "/notes/kms.md" },
      { text: "开发环境", link: "/notes/environment.md" },
      { text: "常用命令", link: "/command/" },
      { text: "面试指南", link: "/interview/" },
    ],
  },
]);


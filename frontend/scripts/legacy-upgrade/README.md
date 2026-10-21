# 旧报表模板独立升级

前端运行时只读取当前配置，不再自动执行 alpha、beta、RC 历史转换。
已存在且结构为当前格式的数据库报表可以直接读取，不会在打开时改写版本、样式或坐标。

要求 Node 22.12+，先在 frontend 目录安装项目依赖。转换 `.viz` 或解压后的 JSON 模板：

```sh
cd frontend
node scripts/upgrade-legacy-template.mjs --input /path/old.viz --output /path/upgraded.viz
```

早期 Java 二进制 `.viz` 还需要当前后端安装目录和运行后端所用的 JDK：

```sh
node scripts/upgrade-legacy-template.mjs --input /path/old.viz --output /path/upgraded.viz --server-dir /opt/datart
```

工具独立运行，不连接数据库、不调用在线接口、不覆盖原文件，也拒绝覆盖已经存在的输出文件。
支持仪表板模板和图表模板；保留资源 ID、内嵌数据、关联和附件，历史配置通过原有转换器升级。
输出仍是原来的 gzip `.viz` 或 JSON 格式，通过原来的“模板导入”入口导入转换后的文件。
不支持组织包或完整资源迁移包；这些包继续使用产品中的资源迁移流程。

自动布局坐标保持原值。如需从旧网格升级坐标，先将 JSON 模板交给仓库已有的
`tools/grid-layout-migration.mjs` 预览和转换，再导入；有重叠或缺少位置时应先核对布局。
工具沿用历史转换规则：容器边框、内边距及查询按钮颜色会采用当前默认样式。
数据库中的历史格式资源需要先导出、转换、验证后再迁移；不要直接批量修改数据库 JSON。

验证：

```sh
npm run check:upgrade-baseline
npx vitest run scripts/legacy-upgrade
node --test scripts/__tests__/upgrade-legacy-template.test.mjs
```

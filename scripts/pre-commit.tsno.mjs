#!/usr/bin/env zx
import {createRequire as __$$createRequireN} from 'module';var require=__$$createRequireN(import.meta.url);
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// node_modules/.pnpm/tsno@2.0.0/node_modules/tsno/dist/client.js
import { createRequire as __$$createRequire } from "module";
var require2;
var init_client = __esm({
  "node_modules/.pnpm/tsno@2.0.0/node_modules/tsno/dist/client.js"() {
    require2 = __$$createRequire("file://D:\\work\\low-code\\my-low-code\\node_modules\\.pnpm\\tsno@2.0.0\\node_modules\\tsno\\dist\\client.js");
  }
});

// scripts/utils.ts
function printObject(object, method = "log") {
  for (const [key, value] of Object.entries(object)) {
    console[method](`${key}:
${value}
`);
  }
}
var init_utils = __esm({
  "scripts/utils.ts"() {
    init_client();
  }
});

// scripts/check.ts
var check_exports = {};
import { $ } from "zx";
var init_check = __esm({
  async "scripts/check.ts"() {
    init_client();
    init_utils();
    await Promise.all([$`pnpm lint`]).catch((out) => {
      printObject(out);
      throw new Error(out.stdout);
    });
  }
});

// scripts/pre-commit.ts
init_client();
import { $ as $2 } from "zx";
console.log("\u5F00\u59CB\u6267\u884C\u4EE3\u7801\u8D28\u91CF\u8BC4\u4F30...\n");
await init_check().then(() => check_exports).catch((out) => {
  console.log(out);
  throw new Error("\u4EE3\u7801\u8D28\u91CF\u8BC4\u4F30\u5931\u8D25, \u8BF7\u68C0\u67E5\u4EE3\u7801");
});
console.log('printf "\u68C0\u6D4B\u901A\u8FC7, \u521B\u5EFA commit \u4E2D...\n');
await $2`git add .`;
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibm9kZV9tb2R1bGVzLy5wbnBtL3Rzbm9AMi4wLjAvbm9kZV9tb2R1bGVzL3Rzbm8vZGlzdC9jbGllbnQuanMiLCAic2NyaXB0cy91dGlscy50cyIsICJzY3JpcHRzL2NoZWNrLnRzIiwgInNjcmlwdHMvcHJlLWNvbW1pdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtjcmVhdGVSZXF1aXJlIGFzIF9fJCRjcmVhdGVSZXF1aXJlfSBmcm9tICdtb2R1bGUnO3ZhciByZXF1aXJlPV9fJCRjcmVhdGVSZXF1aXJlKFwiZmlsZTovL0Q6XFxcXHdvcmtcXFxcbG93LWNvZGVcXFxcbXktbG93LWNvZGVcXFxcbm9kZV9tb2R1bGVzXFxcXC5wbnBtXFxcXHRzbm9AMi4wLjBcXFxcbm9kZV9tb2R1bGVzXFxcXHRzbm9cXFxcZGlzdFxcXFxjbGllbnQuanNcIik7XG5pbXBvcnQge1xuICBjb2xvcnNcbn0gZnJvbSBcIi4vY2h1bmstRkhEWFhPS1kuanNcIjtcblxuXG4vLyBzcmMvY2xpZW50LnRzXG52YXIgZmV0Y2ggPSAodXJsLCBpbml0KSA9PiBpbXBvcnQoXCIuL3NyYy00UTdRNjdDMy5qc1wiKS50aGVuKChyZXMpID0+IHJlcy5kZWZhdWx0KHVybCwgaW5pdCkpO1xudmFyIGF4aW9zID0gKGNvbmZpZykgPT4gaW1wb3J0KFwiLi9heGlvcy1QSVo0QzVVWi5qc1wiKS50aGVuKChyZXMpID0+IHJlcy5kZWZhdWx0KGNvbmZpZykpO1xuZXhwb3J0IHtcbiAgYXhpb3MsXG4gIGNvbG9ycyxcbiAgZmV0Y2hcbn07XG4iLCAiaW1wb3J0IHsgUHJvY2Vzc091dHB1dCB9IGZyb20gJ3p4L2NvcmUnXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcHJpbnRPYmplY3QoXHJcbiAgb2JqZWN0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IFByb2Nlc3NPdXRwdXQsXHJcbiAgbWV0aG9kOiAnbG9nJyB8ICd3YXJuJyB8ICdlcnJvcicgPSAnbG9nJ1xyXG4pIHtcclxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhvYmplY3QpKSB7XHJcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxyXG4gICAgY29uc29sZVttZXRob2RdKGAke2tleX06XFxuJHt2YWx1ZX1cXG5gKVxyXG4gIH1cclxufVxyXG4iLCAiIyEvdXNyL2Jpbi9lbnYgenhcclxuXHJcbmltcG9ydCB0eXBlIHsgUHJvY2Vzc091dHB1dCB9IGZyb20gJ3p4J1xyXG5pbXBvcnQgeyAkIH0gZnJvbSAnengnXHJcblxyXG5pbXBvcnQgeyBwcmludE9iamVjdCB9IGZyb20gJy4vdXRpbHMnXHJcblxyXG5cclxuYXdhaXQgUHJvbWlzZS5hbGwoWyRgcG5wbSBsaW50YF0pLmNhdGNoKChvdXQ6IFByb2Nlc3NPdXRwdXQpID0+IHtcclxuICBwcmludE9iamVjdChvdXQpXHJcbiAgdGhyb3cgbmV3IEVycm9yKG91dC5zdGRvdXQpXHJcbn0pXHJcblxyXG4vLyBhd2FpdCAkYHBucG0gc3BlbGxjaGVja2AuY2F0Y2goKG91dDogUHJvY2Vzc091dHB1dCkgPT4ge1xyXG4vLyAgIGNvbnNvbGUubG9nKG91dClcclxuLy9cclxuLy8gICB0aHJvdyBuZXcgRXJyb3Iob3V0LnN0ZG91dClcclxuLy8gfSlcclxuXHJcbi8vIGF3YWl0IFByb21pc2UuYWxsKFskYHBucG0gdHlwZS1jaGVja2AsICRgcG5wbSBsaW50YF0pLmNhdGNoKChvdXQ6IFByb2Nlc3NPdXRwdXQpID0+IHtcclxuLy8gICBwcmludE9iamVjdChvdXQpXHJcbi8vICAgdGhyb3cgbmV3IEVycm9yKG91dC5zdGRvdXQpXHJcbi8vIH0pXHJcblxyXG4vLyBjaGVjayB0eXBlIGFuZCBzdGFnZVxyXG4iLCAiIyEvdXNyL2Jpbi9lbnYgenhcclxuXHJcbmltcG9ydCB7ICQgfSBmcm9tICd6eCdcclxuXHJcbmNvbnNvbGUubG9nKCdcdTVGMDBcdTU5Q0JcdTYyNjdcdTg4NENcdTRFRTNcdTc4MDFcdThEMjhcdTkxQ0ZcdThCQzRcdTRGMzAuLi5cXG4nKVxyXG5cclxuYXdhaXQgaW1wb3J0KCcuL2NoZWNrJykuY2F0Y2goKG91dCkgPT4ge1xyXG4gIGNvbnNvbGUubG9nKG91dClcclxuICB0aHJvdyBuZXcgRXJyb3IoJ1x1NEVFM1x1NzgwMVx1OEQyOFx1OTFDRlx1OEJDNFx1NEYzMFx1NTkzMVx1OEQyNSwgXHU4QkY3XHU2OEMwXHU2N0U1XHU0RUUzXHU3ODAxJylcclxufSlcclxuXHJcbmNvbnNvbGUubG9nKCdwcmludGYgXCJcdTY4QzBcdTZENEJcdTkwMUFcdThGQzcsIFx1NTIxQlx1NUVGQSBjb21taXQgXHU0RTJELi4uXFxuJylcclxuXHJcbmF3YWl0ICRgZ2l0IGFkZCAuYFxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQUFBLFNBQVEsaUJBQWlCLHlCQUF3QjtBQUFqRCxJQUE4REE7QUFBOUQ7QUFBQTtBQUEwRCxJQUFJQSxXQUFRLGtCQUFrQiw4R0FBOEc7QUFBQTtBQUFBOzs7QUNFL0wsU0FBUyxZQUNkLFFBQ0EsU0FBbUMsT0FDbkM7QUFDQSxhQUFXLENBQUMsS0FBSyxLQUFLLEtBQUssT0FBTyxRQUFRLE1BQU0sR0FBRztBQUVqRCxZQUFRLFFBQVEsR0FBRztBQUFBLEVBQVM7QUFBQSxDQUFTO0FBQUEsRUFDdkM7QUFDRjtBQVZBO0FBQUE7QUFBQTtBQUFBO0FBQUE7OztBQ0FBO0FBR0EsU0FBUyxTQUFTO0FBSGxCO0FBQUE7QUFBQTtBQUtBO0FBR0EsVUFBTSxRQUFRLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxNQUFNLENBQUMsUUFBdUI7QUFDOUQsa0JBQVksR0FBRztBQUNmLFlBQU0sSUFBSSxNQUFNLElBQUksTUFBTTtBQUFBLElBQzVCLENBQUM7QUFBQTtBQUFBOzs7QUNYRDtBQUVBLFNBQVMsS0FBQUMsVUFBUztBQUVsQixRQUFRLElBQUksbUVBQWlCO0FBRTdCLE1BQU0sdUNBQWtCLE1BQU0sQ0FBQyxRQUFRO0FBQ3JDLFVBQVEsSUFBSSxHQUFHO0FBQ2YsUUFBTSxJQUFJLE1BQU0sa0ZBQWlCO0FBQ25DLENBQUM7QUFFRCxRQUFRLElBQUksbUVBQWdDO0FBRTVDLE1BQU1BOyIsCiAgIm5hbWVzIjogWyJyZXF1aXJlIiwgIiQiXQp9Cg==

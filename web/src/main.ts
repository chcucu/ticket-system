import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { appConfig } from "./app.config";
import App from "./App.vue";

// 浏览器标题跟随 app.config 的品牌名（开源自定义入口）
document.title = `${appConfig.site.name} · ${appConfig.site.tagline || "反馈"}`;
// 移动端地址栏主题色同步
const meta = document.querySelector('meta[name="theme-color"]');
if (meta) meta.setAttribute("content", appConfig.theme.accent);

const app = createApp(App);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");

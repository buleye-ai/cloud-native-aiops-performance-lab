import DefaultTheme from "vitepress/theme";
import ThoughtTimeline from "./ThoughtTimeline.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ThoughtTimeline", ThoughtTimeline);
  }
};

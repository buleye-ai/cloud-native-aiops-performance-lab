import DefaultTheme from "vitepress/theme";
import LearningTimeline from "./LearningTimeline.vue";
import ThoughtTimeline from "./ThoughtTimeline.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("LearningTimeline", LearningTimeline);
    app.component("ThoughtTimeline", ThoughtTimeline);
  }
};

import { useLayoutEffect } from "react";
import { BENCH_GLASS, rectangleToQuad } from "../domain/benchProjection";

export function useBenchProjection(ref) {
  useLayoutEffect(() => {
    const instruments = ref.current;
    const hull = instruments?.closest(".cockpit-bench")?.querySelector(".cockpit-bench__hull");
    if (!hull) return;
    const screens = [...instruments.querySelectorAll(".bench-screen")];
    const project = () => {
      if (!window.matchMedia("(min-width: 821px)").matches) return;
      const width = hull.clientWidth, height = hull.clientHeight;
      if (!width || !height) return;
      for (const screen of screens) {
        const kind = screen.id.replace("bench-", "");
        const paneWidth = width * (kind === "feed" ? .29 : .25);
        const paneHeight = height * .43;
        const corners = BENCH_GLASS[kind].map(([x, y]) => [
          x * width - instruments.offsetLeft,
          y * height - instruments.offsetTop,
        ]);
        const matrix = rectangleToQuad(paneWidth, paneHeight, corners);
        if (!matrix) continue;
        screen.style.setProperty("--pane-width", `${paneWidth}px`);
        screen.style.setProperty("--pane-height", `${paneHeight}px`);
        screen.style.setProperty("--pane-projection", `matrix3d(${matrix.join(",")})`);
      }
    };
    project();
    const observer = new ResizeObserver(project);
    observer.observe(hull);
    return () => observer.disconnect();
  }, [ref]);
}

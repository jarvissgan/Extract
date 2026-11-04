import confetti from "canvas-confetti";

// A short burst from both sides, then one from the middle.
// Skipped for people who've asked their system for reduced motion.
export const celebrate = (colors: string[], withHoneyPots = false) => {
  const shapes: confetti.Shape[] = withHoneyPots
    ? [confetti.shapeFromText({ text: "🍯", scalar: 2 }), "circle", "square"]
    : ["square", "circle"];
  const base = { colors, shapes, scalar: withHoneyPots ? 1.4 : 1, disableForReducedMotion: true, zIndex: 10000 };
  confetti({ ...base, particleCount: 90, spread: 70, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...base, particleCount: 90, spread: 70, angle: 120, origin: { x: 1, y: 0.75 } });
  setTimeout(() => confetti({ ...base, particleCount: 140, spread: 110, startVelocity: 45, origin: { y: 0.6 } }), 250);
};

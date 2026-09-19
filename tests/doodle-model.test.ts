import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GENZ_PACK, MIXED_PACK } from "@/lib/game/words";

/**
 * The classifier ships as a static asset, so nothing at build time would notice
 * it going missing or drifting away from the word list. These are the two
 * invariants worth holding: the files parse, and every label the model can say
 * is a word this game might actually have handed somebody.
 */
const MODELS = path.join(process.cwd(), "public", "models");

interface ModelMeta {
  labels: string[];
  tensors: { name: string; shape: number[]; offset: number; count: number; scale: number }[];
  input: { width: number; height: number };
  accuracy: { top1: number; top3: number };
}

function readMeta(): ModelMeta {
  return JSON.parse(fs.readFileSync(path.join(MODELS, "doodle-v1.json"), "utf8")) as ModelMeta;
}

describe("doodle classifier asset", () => {
  it("ships both files", () => {
    expect(fs.existsSync(path.join(MODELS, "doodle-v1.json"))).toBe(true);
    expect(fs.existsSync(path.join(MODELS, "doodle-v1.bin"))).toBe(true);
  });

  it("declares tensors that exactly fill the weights file", () => {
    const meta = readMeta();
    const bytes = fs.statSync(path.join(MODELS, "doodle-v1.bin")).size;
    const declared = meta.tensors.reduce((total, tensor) => total + tensor.count, 0);
    expect(declared).toBe(bytes);

    for (const tensor of meta.tensors) {
      const fromShape = tensor.shape.reduce((a, b) => a * b, 1);
      expect(tensor.count).toBe(fromShape);
      expect(tensor.scale).toBeGreaterThan(0);
    }
  });

  it("takes the 28x28 input the preprocessing produces", () => {
    const meta = readMeta();
    expect(meta.input).toEqual({ width: 28, height: 28 });
    expect(meta.tensors.find((t) => t.name === "w1")?.shape[0]).toBe(28 * 28);
    expect(meta.tensors.find((t) => t.name === "b3")?.count).toBe(meta.labels.length);
  });

  it("only knows words this game can actually serve", () => {
    const meta = readMeta();
    const playable = new Set(
      [...MIXED_PACK, ...GENZ_PACK].map((entry) => entry.word.toLowerCase()),
    );
    const strangers = meta.labels.filter((label) => !playable.has(label));
    expect(strangers).toEqual([]);
  });

  it("is worth showing at all", () => {
    const meta = readMeta();
    expect(meta.labels.length).toBeGreaterThanOrEqual(10);
    // Top-3 is what the overlay displays, so that is the bar that matters.
    expect(meta.accuracy.top3).toBeGreaterThan(0.6);
  });
});

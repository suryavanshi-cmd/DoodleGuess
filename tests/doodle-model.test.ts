import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GENZ_PACK, MIXED_PACK } from "@/lib/game/words";
import { datasetCategory, labelMatches, modelKnows, normalizeLabel, promptableLabels } from "@/lib/doodle/labels";

/**
 * The classifier ships as a static asset, so nothing at build time would notice
 * it going missing or drifting away from the word list. These are the two
 * invariants worth holding: the files parse, and every label the model can say
 * is a word this game might actually have handed somebody.
 */
const MODELS = path.join(process.cwd(), "public", "models");
const META = path.join(MODELS, "doodle-v2.json");
const WEIGHTS = path.join(MODELS, "doodle-v2.bin");

interface ModelMeta {
  labels: string[];
  tensors: { name: string; shape: number[]; offset: number; count: number; scale: number }[];
  input: { width: number; height: number };
  accuracy: { top1: number; top3: number };
}

function readMeta(): ModelMeta {
  return JSON.parse(fs.readFileSync(META, "utf8")) as ModelMeta;
}

describe("doodle classifier asset", () => {
  it("ships both files", () => {
    expect(fs.existsSync(META)).toBe(true);
    expect(fs.existsSync(WEIGHTS)).toBe(true);
  });

  it("declares tensors that exactly fill the weights file", () => {
    const meta = readMeta();
    const bytes = fs.statSync(WEIGHTS).size;
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

  /**
   * The model now knows every category the dataset publishes, which is a
   * superset of this game's word list rather than a subset of it. So the
   * invariant flipped: what matters is no longer that the model stays inside
   * the word list, but that it covers as much of it as the dataset allows.
   */
  it("covers the words the dataset has a category for", () => {
    const meta = readMeta();
    const playable = [...MIXED_PACK, ...GENZ_PACK].map((entry) => entry.word);
    const covered = playable.filter((word) => modelKnows(meta.labels, word));
    // 231 words, of which Quick, Draw! has a category for about 78. Well under
    // that means the labels or the aliases have drifted.
    expect(covered.length).toBeGreaterThanOrEqual(70);
  });

  it("has a label behind every alias", () => {
    const meta = readMeta();
    const known = new Set(meta.labels.map(normalizeLabel));
    // An alias pointing at nothing is silently the same as having no alias,
    // which is exactly the kind of rot a test should catch.
    for (const word of ["ball", "balloon", "boat", "burger", "coffee", "drum", "turtle"]) {
      expect({ word, known: known.has(normalizeLabel(datasetCategory(word))) })
        .toEqual({ word, known: true });
    }
  });

  it("leaves the undrawable categories out of solo prompts", () => {
    const meta = readMeta();
    const prompts = promptableLabels(meta.labels);
    expect(prompts).not.toContain("The Mona Lisa");
    expect(prompts).not.toContain("animal migration");
    expect(prompts.length).toBeGreaterThan(meta.labels.length - 10);
  });

  it("is worth showing at all", () => {
    const meta = readMeta();
    expect(meta.labels.length).toBeGreaterThanOrEqual(300);
    // Top-3 is what the overlay displays, so that is the bar that matters.
    expect(meta.accuracy.top3).toBeGreaterThan(0.6);
  });
});

describe("label matching", () => {
  it("accepts the dataset's name for the game's word", () => {
    expect(labelMatches("sea turtle", "turtle")).toBe(true);
    expect(labelMatches("hamburger", "burger")).toBe(true);
    expect(labelMatches("hot air balloon", "balloon")).toBe(true);
  });

  it("still matches the plain cases, punctuation and case aside", () => {
    expect(labelMatches("cat", "cat")).toBe(true);
    expect(labelMatches("Hot Dog", "hot dog")).toBe(true);
    expect(labelMatches("t-shirt", "t shirt")).toBe(true);
  });

  it("does not match a different thing", () => {
    expect(labelMatches("cat", "dog")).toBe(false);
    expect(labelMatches("sea turtle", "sea")).toBe(false);
    expect(labelMatches("cat", null)).toBe(false);
  });

  it("knows what it does not know", () => {
    const labels = ["cat", "sea turtle"];
    expect(modelKnows(labels, "cat")).toBe(true);
    expect(modelKnows(labels, "turtle")).toBe(true);
    expect(modelKnows(labels, "situationship")).toBe(false);
    expect(modelKnows(labels, null)).toBe(false);
  });
});

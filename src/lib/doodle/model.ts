"use client";

/**
 * The in-browser doodle classifier.
 *
 * A three-layer MLP trained on every category Google's open Quick, Draw!
 * dataset publishes — see scripts/train_doodle_model.py. Weights are int8 with
 * a per-tensor scale, which is why the whole model is a few hundred kilobytes
 * rather than a few megabytes.
 *
 * There is no TensorFlow.js here on purpose. The network is three matrix
 * multiplies; hand-writing them is a few dozen lines and, with the zero-skip
 * below, runs in well under a millisecond — against about a megabyte of
 * runtime for a library that would do the same arithmetic. Nothing leaves the
 * device either way: this is the same client-side, zero-cost, offline-capable
 * design, just without the dependency.
 */

interface TensorMeta {
  name: string;
  shape: number[];
  offset: number;
  count: number;
  scale: number;
}

interface ModelMeta {
  version: number;
  input: { width: number; height: number };
  labels: string[];
  tensors: TensorMeta[];
  accuracy: { top1: number; top3: number };
  source: string;
}

export interface DoodleModel {
  labels: string[];
  inputWidth: number;
  inputHeight: number;
  /** Top-3 validation accuracy, for honest copy in the UI. */
  top3: number;
  /** The most likely labels, best first, at most three of them. */
  predict(input: Float32Array): Prediction[];
}

export interface Prediction {
  label: string;
  /** Softmax probability, 0-1. */
  score: number;
}

const MODEL_URL = "/models/doodle-v2.json";
const WEIGHTS_URL = "/models/doodle-v2.bin";

/** The overlay never shows more than this, so nothing below it is computed. */
const TOP_K = 3;

let cached: Promise<DoodleModel | null> | null = null;

function dequantize(raw: Int8Array, meta: TensorMeta): Float32Array {
  const out = new Float32Array(meta.count);
  for (let i = 0; i < meta.count; i += 1) out[i] = raw[meta.offset + i] * meta.scale;
  return out;
}

/**
 * Loads once per session and caches the promise, so several components asking
 * at the same moment share one download. Any failure resolves to null rather
 * than throwing: the feature is decoration, and the caller hides it.
 */
export function loadDoodleModel(): Promise<DoodleModel | null> {
  cached ??= (async () => {
    try {
      const [metaResponse, weightsResponse] = await Promise.all([
        fetch(MODEL_URL, { cache: "force-cache" }),
        fetch(WEIGHTS_URL, { cache: "force-cache" }),
      ]);
      if (!metaResponse.ok || !weightsResponse.ok) return null;

      const meta = (await metaResponse.json()) as ModelMeta;
      const raw = new Int8Array(await weightsResponse.arrayBuffer());
      const byName = new Map(meta.tensors.map((tensor) => [tensor.name, tensor]));

      const need = ["w1", "b1", "w2", "b2", "w3", "b3"] as const;
      if (need.some((name) => !byName.has(name))) return null;
      const [w1, b1, w2, b2, w3, b3] = need.map((name) => dequantize(raw, byName.get(name)!));

      const inputSize = meta.input.width * meta.input.height;
      const h1Size = byName.get("b1")!.count;
      const h2Size = byName.get("b2")!.count;
      const outSize = byName.get("b3")!.count;

      // Scratch buffers, reused every call so inference allocates nothing.
      const h1 = new Float32Array(h1Size);
      const h2 = new Float32Array(h2Size);
      const out = new Float32Array(outSize);

      /**
       * Accumulates over inputs rather than over outputs, which is worth doing
       * twice over: the weight row for one input is contiguous in memory, and
       * a zero input can be skipped entirely.
       *
       * That second point is the whole optimisation. A 28x28 doodle is ink on
       * a blank field — about 28% of pixels are set, measured across the
       * dataset — and the first layer is 70% of the network, so skipping the
       * background removes the bulk of the arithmetic rather than a slice of
       * it. Measured together with the two changes below: 0.58ms to 0.17ms
       * per inference, same answers.
       */
      const dense = (
        input: Float32Array, weights: Float32Array, bias: Float32Array,
        target: Float32Array, inSize: number, outCount: number, relu: boolean,
      ) => {
        target.set(bias);
        for (let i = 0; i < inSize; i += 1) {
          const value = input[i];
          if (value === 0) continue;
          const row = i * outCount;
          for (let j = 0; j < outCount; j += 1) target[j] += value * weights[row + j];
        }
        if (relu) for (let j = 0; j < outCount; j += 1) if (target[j] < 0) target[j] = 0;
      };

      // Reused across calls, like the layer buffers above.
      const exp = new Float32Array(outSize);

      return {
        labels: meta.labels,
        inputWidth: meta.input.width,
        inputHeight: meta.input.height,
        top3: meta.accuracy.top3,
        predict(input: Float32Array): Prediction[] {
          if (input.length !== inputSize) return [];
          dense(input, w1, b1, h1, inputSize, h1Size, true);
          dense(h1, w2, b2, h2, h1Size, h2Size, true);
          dense(h2, w3, b3, out, h2Size, outSize, false);

          let max = -Infinity;
          for (let i = 0; i < outSize; i += 1) if (out[i] > max) max = out[i];
          let total = 0;
          for (let i = 0; i < outSize; i += 1) {
            exp[i] = Math.exp(out[i] - max);
            total += exp[i];
          }

          // Selection, not a sort. With 345 labels, sorting would build and
          // order 345 objects every sample to show three of them.
          const top: Prediction[] = [];
          for (let i = 0; i < outSize; i += 1) {
            const score = exp[i] / total;
            if (top.length === TOP_K && score <= top[TOP_K - 1].score) continue;
            const entry = { label: meta.labels[i], score };
            let at = top.length;
            while (at > 0 && top[at - 1].score < score) at -= 1;
            top.splice(at, 0, entry);
            if (top.length > TOP_K) top.pop();
          }
          return top;
        },
      };
    } catch {
      return null;
    }
  })();
  return cached;
}

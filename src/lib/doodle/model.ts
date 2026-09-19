"use client";

/**
 * The in-browser doodle classifier.
 *
 * A three-layer MLP trained on Google's open Quick, Draw! dataset, restricted
 * to categories that appear in this game's word list — see
 * scripts/train_doodle_model.py. Weights are int8 with a per-tensor scale,
 * which is why the whole model is about 110 kB.
 *
 * There is no TensorFlow.js here on purpose. The network is three matrix
 * multiplies totalling roughly 110k multiply-accumulates; hand-writing that is
 * a few dozen lines and runs in well under a millisecond, against about a
 * megabyte of runtime for a library that would do the same arithmetic. Nothing
 * leaves the device either way: this is the same client-side, zero-cost,
 * offline-capable design, just without the dependency.
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
  predict(input: Float32Array): Prediction[];
}

export interface Prediction {
  label: string;
  /** Softmax probability, 0-1. */
  score: number;
}

const MODEL_URL = "/models/doodle-v1.json";
const WEIGHTS_URL = "/models/doodle-v1.bin";

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

      const dense = (
        input: Float32Array, weights: Float32Array, bias: Float32Array,
        target: Float32Array, inSize: number, outCount: number, relu: boolean,
      ) => {
        for (let j = 0; j < outCount; j += 1) {
          let sum = bias[j];
          for (let i = 0; i < inSize; i += 1) sum += input[i] * weights[i * outCount + j];
          target[j] = relu && sum < 0 ? 0 : sum;
        }
      };

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
          const exp = new Float32Array(outSize);
          for (let i = 0; i < outSize; i += 1) {
            exp[i] = Math.exp(out[i] - max);
            total += exp[i];
          }

          return meta.labels
            .map((label, index) => ({ label, score: exp[index] / total }))
            .sort((a, b) => b.score - a.score);
        },
      };
    } catch {
      return null;
    }
  })();
  return cached;
}

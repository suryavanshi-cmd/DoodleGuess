#!/usr/bin/env python3
"""
Trains the in-browser doodle classifier on Google's open Quick, Draw! dataset.

Every category the dataset publishes is used — the list is fetched from the
dataset repository itself rather than hard-coded here, so this cannot drift
from what the data actually contains.

The bitmaps are plain .npy (28x28 uint8) served over HTTP with range support,
so each category is fetched a slice at a time rather than in full: the complete
set is gigabytes and a few thousand samples each is plenty.

Output is a small quantised MLP that the browser loads directly:
  public/models/doodle-v2.json  labels, shapes and dequantisation scales
  public/models/doodle-v2.bin   int8 weights, concatenated in layer order

Run with:  python3 scripts/train_doodle_model.py
Env knobs: PER_CLASS, EPOCHS, HIDDEN1, HIDDEN2, QUICKDRAW_CACHE, MODEL_OUT
"""
import io
import json
import os
import struct
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

BASE = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"
CATEGORIES_URL = (
    "https://raw.githubusercontent.com/googlecreativelab/quickdraw-dataset/master/categories.txt"
)
ROOT = Path(__file__).resolve().parent.parent
# Overridable so a longer run can be trained and compared without disturbing
# the model the app is currently serving.
OUT = Path(os.environ.get("MODEL_OUT", ROOT / "public" / "models"))
CACHE = Path(os.environ.get("QUICKDRAW_CACHE", "/tmp/quickdraw-cache"))

PER_CLASS = int(os.environ.get("PER_CLASS", "2500"))
HIDDEN1 = int(os.environ.get("HIDDEN1", "256"))
HIDDEN2 = int(os.environ.get("HIDDEN2", "128"))
EPOCHS = int(os.environ.get("EPOCHS", "20"))
BATCH = 512
# Adam rather than the plain SGD this started with: 345 classes is a much
# harder problem than 45, and per-parameter step sizes are most of what closes
# the gap without making the network bigger.
LR = 2e-3
BETA1, BETA2, EPS = 0.9, 0.999, 1e-8
WEIGHT_DECAY = 1e-5
DROPOUT = 0.1
SEED = 7


def npy_data_offset(head: bytes) -> tuple[int, int]:
    """Returns (offset of first sample, bytes per sample) for a .npy header."""
    if head[:6] != b"\x93NUMPY":
        raise ValueError("not a .npy file")
    major = head[6]
    if major == 1:
        header_len = struct.unpack("<H", head[8:10])[0]
        offset = 10 + header_len
    else:
        header_len = struct.unpack("<I", head[8:12])[0]
        offset = 12 + header_len
    header = head[(10 if major == 1 else 12):offset].decode("latin1")
    # numpy writes uint8 as the descr shorthand '|u1'.
    if "|u1" not in header and "uint8" not in header:
        raise ValueError(f"unexpected dtype in {header}")
    return offset, 784


def fetch(url: str, start: int | None = None, length: int | None = None) -> bytes:
    headers = {}
    if start is not None and length is not None:
        headers["Range"] = f"bytes={start}-{start + length - 1}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def category_names() -> list[str]:
    """The dataset's own category list, cached so a rerun is offline-capable."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / "categories.txt"
    if not cached.exists():
        cached.write_bytes(fetch(CATEGORIES_URL))
    names = [line.strip() for line in cached.read_text().splitlines() if line.strip()]
    if len(names) < 100:
        raise ValueError(f"category list looks wrong ({len(names)} entries)")
    return names


def load_category(name: str, count: int) -> np.ndarray | None:
    """First `count` bitmaps of a category, cached on disk between runs."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{name.replace(' ', '_')}-{count}.npy"
    if cached.exists():
        return np.load(cached)

    url = f"{BASE}/{urllib.parse.quote(name)}.npy"
    try:
        head = fetch(url, 0, 256)
        offset, stride = npy_data_offset(head)
        raw = fetch(url, offset, stride * count)
    except Exception as error:  # noqa: BLE001 - any failure just drops the class
        print(f"  skip {name}: {error}")
        return None

    usable = len(raw) // stride
    if usable < count // 2:
        print(f"  skip {name}: only {usable} samples available")
        return None
    data = np.frombuffer(raw[: usable * stride], dtype=np.uint8).reshape(usable, stride)
    np.save(cached, data)
    return data


def main() -> int:
    candidates = category_names()
    print(f"Fetching up to {PER_CLASS} samples for {len(candidates)} categories")
    chunks: list[np.ndarray] = []
    labels: list[np.ndarray] = []
    names: list[str] = []

    for position, name in enumerate(candidates):
        data = load_category(name, PER_CLASS)
        if data is None:
            continue
        labels.append(np.full(len(data), len(names), dtype=np.int64))
        names.append(name)
        chunks.append(data)
        if position % 25 == 0:
            print(f"  {position + 1}/{len(candidates)} {name}: {len(data)}")

    if len(names) < 5:
        print("Not enough categories resolved; aborting.")
        return 1

    # Samples stay uint8 all the way to the batch. At this size the float32
    # copy of the whole set would be several gigabytes of resident memory for
    # no gain — each batch is converted as it is used instead.
    x = np.concatenate(chunks)
    y = np.concatenate(labels)
    del chunks, labels
    print(f"{x.shape[0]} samples across {len(names)} classes")

    rng = np.random.default_rng(SEED)
    order = rng.permutation(len(x))
    x, y = x[order], y[order]
    split = int(len(x) * 0.96)
    x_train, y_train = x[:split], y[:split]
    x_val, y_val = x[split:].astype(np.float32) / 255.0, y[split:]

    def init(fan_in: int, fan_out: int) -> np.ndarray:
        return (rng.standard_normal((fan_in, fan_out)) * np.sqrt(2.0 / fan_in)).astype(np.float32)

    params = {
        "w1": init(784, HIDDEN1), "b1": np.zeros(HIDDEN1, np.float32),
        "w2": init(HIDDEN1, HIDDEN2), "b2": np.zeros(HIDDEN2, np.float32),
        "w3": init(HIDDEN2, len(names)), "b3": np.zeros(len(names), np.float32),
    }
    moment1 = {key: np.zeros_like(value) for key, value in params.items()}
    moment2 = {key: np.zeros_like(value) for key, value in params.items()}

    def forward(batch: np.ndarray):
        h1 = np.maximum(batch @ params["w1"] + params["b1"], 0)
        h2 = np.maximum(h1 @ params["w2"] + params["b2"], 0)
        return h1, h2, h2 @ params["w3"] + params["b3"]

    def logits_of(batch: np.ndarray, rows: int = 8192) -> np.ndarray:
        """Chunked so validation never materialises a huge intermediate."""
        return np.concatenate([forward(batch[i:i + rows])[2] for i in range(0, len(batch), rows)])

    step = 0
    for epoch in range(EPOCHS):
        shuffle = rng.permutation(len(x_train))
        x_train, y_train = x_train[shuffle], y_train[shuffle]
        # Cosine decay: a long high-LR phase to find the basin, a slow tail to
        # settle into it. Worth more here than any extra epochs would be.
        lr = LR * 0.5 * (1 + np.cos(np.pi * epoch / EPOCHS))

        for start in range(0, len(x_train) - BATCH + 1, BATCH):
            xb = x_train[start:start + BATCH].astype(np.float32) / 255.0
            yb = y_train[start:start + BATCH]
            h1, h2, logits = forward(xb)

            # Inverted dropout, so inference needs no scaling of its own.
            if DROPOUT > 0:
                mask1 = (rng.random(h1.shape) >= DROPOUT).astype(np.float32) / (1 - DROPOUT)
                mask2 = (rng.random(h2.shape) >= DROPOUT).astype(np.float32) / (1 - DROPOUT)
                h1 = h1 * mask1
                h2 = h2 * mask2
                logits = h2 @ params["w3"] + params["b3"]

            logits -= logits.max(1, keepdims=True)
            exp = np.exp(logits)
            probs = exp / exp.sum(1, keepdims=True)
            probs[np.arange(len(yb)), yb] -= 1.0
            d_logits = probs / len(yb)

            grads = {}
            grads["w3"] = h2.T @ d_logits
            grads["b3"] = d_logits.sum(0)
            d_h2 = (d_logits @ params["w3"].T) * (h2 > 0)
            if DROPOUT > 0:
                d_h2 *= mask2
            grads["w2"] = h1.T @ d_h2
            grads["b2"] = d_h2.sum(0)
            d_h1 = (d_h2 @ params["w2"].T) * (h1 > 0)
            if DROPOUT > 0:
                d_h1 *= mask1
            grads["w1"] = xb.T @ d_h1
            grads["b1"] = d_h1.sum(0)

            step += 1
            correction1 = 1 - BETA1 ** step
            correction2 = 1 - BETA2 ** step
            for key, param in params.items():
                grad = grads[key]
                if key.startswith("w"):
                    grad = grad + WEIGHT_DECAY * param
                moment1[key] = BETA1 * moment1[key] + (1 - BETA1) * grad
                moment2[key] = BETA2 * moment2[key] + (1 - BETA2) * grad * grad
                param -= lr * (moment1[key] / correction1) / (
                    np.sqrt(moment2[key] / correction2) + EPS
                )

        if epoch % 2 == 1 or epoch == EPOCHS - 1:
            acc = float((logits_of(x_val).argmax(1) == y_val).mean())
            print(f"  epoch {epoch + 1:2d}  lr {lr:.2e}  val top-1 {acc * 100:.1f}%", flush=True)

    val_logits = logits_of(x_val)
    top1_acc = float((val_logits.argmax(1) == y_val).mean())
    top3 = np.argpartition(-val_logits, 3, axis=1)[:, :3]
    top3_acc = float(np.mean([y_val[i] in top3[i] for i in range(len(y_val))]))
    print(f"final: top-1 {top1_acc * 100:.1f}%  top-3 {top3_acc * 100:.1f}%")

    # int8 per-tensor quantisation: the browser multiplies by `scale` on load.
    blob = io.BytesIO()
    tensors = []
    for label in ("w1", "b1", "w2", "b2", "w3", "b3"):
        array = params[label]
        scale = float(np.abs(array).max()) / 127.0 or 1.0
        quantised = np.clip(np.round(array / scale), -127, 127).astype(np.int8)
        tensors.append({
            "name": label,
            "shape": list(array.shape),
            "offset": blob.tell(),
            "count": int(quantised.size),
            "scale": scale,
        })
        blob.write(quantised.tobytes())

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "doodle-v2.bin").write_bytes(blob.getvalue())
    (OUT / "doodle-v2.json").write_text(json.dumps({
        "version": 2,
        "input": {"width": 28, "height": 28},
        "labels": names,
        "tensors": tensors,
        "accuracy": {"top1": round(top1_acc, 4), "top3": round(top3_acc, 4)},
        "source": "Google Quick, Draw! dataset (open data)",
    }, indent=2) + "\n")

    size = (OUT / "doodle-v2.bin").stat().st_size
    print(f"wrote {OUT}/doodle-v2.bin ({size / 1024:.0f} kB) and doodle-v2.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

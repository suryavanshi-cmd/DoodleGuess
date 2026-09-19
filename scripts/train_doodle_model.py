#!/usr/bin/env python3
"""
Trains the in-browser doodle classifier on Google's open Quick, Draw! dataset.

Only the categories that appear in this game's own word list are used, so every
guess the model can make is a word somebody might actually have been given.

The dataset files are plain .npy bitmaps (28x28 uint8) served over HTTP with
range support, so each category is fetched a slice at a time rather than in
full — the complete set is gigabytes and we need a few thousand samples each.

Output is a small quantised MLP that the browser loads directly:
  public/models/doodle-v1.json  labels, shapes and dequantisation scales
  public/models/doodle-v1.bin   int8 weights, concatenated in layer order

Run with:  python3 scripts/train_doodle_model.py
"""
import io
import json
import os
import struct
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

BASE = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "models"
CACHE = Path(os.environ.get("QUICKDRAW_CACHE", "/tmp/quickdraw-cache"))

# Drawn from src/lib/game/words.ts. Anything Quick, Draw! does not have is
# dropped automatically below, so this list can stay optimistic.
CANDIDATES = [
    "cat", "dog", "fish", "bird", "duck", "bee", "frog", "owl", "crab",
    "apple", "pizza", "cake", "bread", "banana", "sandwich", "pineapple",
    "book", "key", "shoe", "hat", "clock", "guitar", "pencil", "scissors",
    "umbrella", "ladder", "bicycle", "helicopter", "lighthouse",
    "sun", "moon", "tree", "star", "cloud", "rainbow", "cactus", "mountain",
    "house", "tent", "castle", "train", "windmill", "sock", "spoon", "camera",
]

PER_CLASS = int(os.environ.get("PER_CLASS", "4000"))
HIDDEN1, HIDDEN2 = 128, 64
EPOCHS = int(os.environ.get("EPOCHS", "24"))
BATCH = 256
LR = 0.05


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


def fetch(url: str, start: int, length: int) -> bytes:
    request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{start + length - 1}"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


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
    print(f"Fetching up to {PER_CLASS} samples for {len(CANDIDATES)} candidate categories")
    images: list[np.ndarray] = []
    labels: list[int] = []
    names: list[str] = []

    for name in CANDIDATES:
        data = load_category(name, PER_CLASS)
        if data is None:
            continue
        index = len(names)
        names.append(name)
        images.append(data)
        labels.append(np.full(len(data), index, dtype=np.int64))
        print(f"  {name}: {len(data)}")

    if len(names) < 5:
        print("Not enough categories resolved; aborting.")
        return 1

    x = np.concatenate(images).astype(np.float32) / 255.0
    y = np.concatenate(labels)
    print(f"{x.shape[0]} samples across {len(names)} classes")

    rng = np.random.default_rng(7)
    order = rng.permutation(len(x))
    x, y = x[order], y[order]
    split = int(len(x) * 0.94)
    x_train, y_train, x_val, y_val = x[:split], y[:split], x[split:], y[split:]

    def init(fan_in: int, fan_out: int) -> np.ndarray:
        return (rng.standard_normal((fan_in, fan_out)) * np.sqrt(2.0 / fan_in)).astype(np.float32)

    w1, b1 = init(784, HIDDEN1), np.zeros(HIDDEN1, np.float32)
    w2, b2 = init(HIDDEN1, HIDDEN2), np.zeros(HIDDEN2, np.float32)
    w3, b3 = init(HIDDEN2, len(names)), np.zeros(len(names), np.float32)

    def forward(batch: np.ndarray):
        h1 = np.maximum(batch @ w1 + b1, 0)
        h2 = np.maximum(h1 @ w2 + b2, 0)
        logits = h2 @ w3 + b3
        return h1, h2, logits

    def accuracy(batch: np.ndarray, target: np.ndarray) -> float:
        _, _, logits = forward(batch)
        return float((logits.argmax(1) == target).mean())

    for epoch in range(EPOCHS):
        shuffle = rng.permutation(len(x_train))
        x_train, y_train = x_train[shuffle], y_train[shuffle]
        lr = LR * (0.5 ** (epoch // 8))
        for start in range(0, len(x_train) - BATCH + 1, BATCH):
            xb = x_train[start:start + BATCH]
            yb = y_train[start:start + BATCH]
            h1, h2, logits = forward(xb)

            logits -= logits.max(1, keepdims=True)
            exp = np.exp(logits)
            probs = exp / exp.sum(1, keepdims=True)
            probs[np.arange(len(yb)), yb] -= 1.0
            d_logits = probs / len(yb)

            g_w3 = h2.T @ d_logits
            g_b3 = d_logits.sum(0)
            d_h2 = (d_logits @ w3.T) * (h2 > 0)
            g_w2 = h1.T @ d_h2
            g_b2 = d_h2.sum(0)
            d_h1 = (d_h2 @ w2.T) * (h1 > 0)
            g_w1 = xb.T @ d_h1
            g_b1 = d_h1.sum(0)

            for param, grad in ((w1, g_w1), (b1, g_b1), (w2, g_w2), (b2, g_b2), (w3, g_w3), (b3, g_b3)):
                param -= lr * grad

        if epoch % 4 == 3 or epoch == EPOCHS - 1:
            print(f"  epoch {epoch + 1:2d}  val top-1 {accuracy(x_val, y_val) * 100:.1f}%")

    _, _, val_logits = forward(x_val)
    top3 = np.argsort(-val_logits, axis=1)[:, :3]
    top3_acc = float(np.mean([y_val[i] in top3[i] for i in range(len(y_val))]))
    top1_acc = accuracy(x_val, y_val)
    print(f"final: top-1 {top1_acc * 100:.1f}%  top-3 {top3_acc * 100:.1f}%")

    # int8 per-tensor quantisation: the browser multiplies by `scale` on load.
    blob = io.BytesIO()
    tensors = []
    for label, array in (("w1", w1), ("b1", b1), ("w2", w2), ("b2", b2), ("w3", w3), ("b3", b3)):
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
    (OUT / "doodle-v1.bin").write_bytes(blob.getvalue())
    (OUT / "doodle-v1.json").write_text(json.dumps({
        "version": 1,
        "input": {"width": 28, "height": 28},
        "labels": names,
        "tensors": tensors,
        "accuracy": {"top1": round(top1_acc, 4), "top3": round(top3_acc, 4)},
        "source": "Google Quick, Draw! dataset (open data)",
    }, indent=2) + "\n")

    size = (OUT / "doodle-v1.bin").stat().st_size
    print(f"wrote public/models/doodle-v1.bin ({size / 1024:.0f} kB) and doodle-v1.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())

import argparse
import base64
import io
import json
import os
import re
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageSequence


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def read_text_file(path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1254", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except Exception:
            continue
    return path.read_text(errors="ignore")


def extract_xml_text(raw: bytes) -> str:
    try:
        root = ET.fromstring(raw)
        return " ".join(part.strip() for part in root.itertext() if part and part.strip())
    except Exception:
        return raw.decode("utf-8", errors="ignore")


def extract_zip_text(path: Path) -> tuple[str, str]:
    preferred_suffixes = (".xml", ".txt", ".md", ".json", ".csv", ".html", ".htm")
    with zipfile.ZipFile(path) as zf:
        names = [name for name in zf.namelist() if not name.endswith("/")]
        if "content.xml" in names:
            raw = zf.read("content.xml")
            return extract_xml_text(raw), "udf_zip_xml"

        if "word/document.xml" in names:
            raw = zf.read("word/document.xml")
            return extract_xml_text(raw), "docx_xml"

        for suffix in preferred_suffixes:
            for name in names:
                if name.lower().endswith(suffix):
                    raw = zf.read(name)
                    if suffix == ".xml":
                        return extract_xml_text(raw), "zip_xml"
                    return raw.decode("utf-8", errors="ignore"), "zip_text"

    return "", "zip_unsupported"


def extract_pdf_text(path: Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(str(path))
    parts = []
    page_limit = min(len(doc), 8)
    for page_index in range(page_limit):
        parts.append(doc[page_index].get_text("text"))
    return "\n".join(parts)


def image_to_supported_payload(path: Path) -> tuple[bytes, str, str]:
    suffix = path.suffix.lower()

    if suffix in {".jpg", ".jpeg"}:
        return path.read_bytes(), "image/jpeg", "image_ocr_jpeg"

    if suffix == ".png":
        return path.read_bytes(), "image/png", "image_ocr_png"

    if suffix == ".webp":
        return path.read_bytes(), "image/webp", "image_ocr_webp"

    if suffix == ".gif":
        return path.read_bytes(), "image/gif", "image_ocr_gif"

    with Image.open(path) as image:
        frames: list[Image.Image] = []
        iterator = ImageSequence.Iterator(image) if getattr(image, "is_animated", False) else [image]

        for frame in iterator:
            prepared = frame.copy()
            if prepared.mode not in {"RGB", "RGBA", "L"}:
                prepared = prepared.convert("RGB")
            frames.append(prepared)
            if len(frames) >= 4:
                break

        if not frames:
            raise RuntimeError("Gorsel dosyada OCR icin okunabilir frame bulunamadi.")

        if len(frames) == 1:
            composite = frames[0]
        else:
            width = max(frame.width for frame in frames)
            height = sum(frame.height for frame in frames)
            composite = Image.new("RGB", (width, height), "white")
            cursor_y = 0
            for frame in frames:
                if frame.mode not in {"RGB", "RGBA"}:
                    frame = frame.convert("RGB")
                composite.paste(frame, (0, cursor_y))
                cursor_y += frame.height

        max_dimension = 1800
        width, height = composite.size
        if max(width, height) > max_dimension:
            scale = max_dimension / max(width, height)
            new_size = (
                max(1, int(width * scale)),
                max(1, int(height * scale)),
            )
            composite = composite.resize(new_size, Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        composite.save(buffer, format="PNG")
        return buffer.getvalue(), "image/png", f"image_ocr_png_converted:{suffix or 'noext'}"


def extract_image_text_with_anthropic(path: Path) -> tuple[str, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Gorsel OCR icin ANTHROPIC_API_KEY tanimli degil.")

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
    api_version = os.getenv("ANTHROPIC_VERSION", "2023-06-01")

    image_bytes, media_type, source_type = image_to_supported_payload(path)
    request_body = {
        "model": model,
        "max_tokens": 2500,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "Bu gorseldeki okunabilir tum metni OCR mantigiyla cikar. "
                            "Yalnizca metni dondur. Aciklama yazma, ozetleme yapma, tahmin etme."
                        ),
                    },
                ],
            }
        ],
    }

    request = urllib.request.Request(
        f"{base_url}/v1/messages",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": api_version,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Anthropic OCR istegi basarisiz: {exc.code} {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Anthropic OCR baglantisi kurulamadi: {exc}") from exc

    text_parts = []
    for item in payload.get("content", []):
        if item.get("type") == "text" and item.get("text"):
            text_parts.append(item["text"])

    return normalize_text("\n".join(text_parts)), source_type


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=True)
    parser.add_argument("--max-chars", type=int, default=5000)
    args = parser.parse_args()

    target = Path(args.path)
    result = {
        "status": "unsupported",
        "sourceType": "unknown",
        "text": "",
        "error": None,
    }

    if not target.exists():
        result["status"] = "error"
        result["error"] = "Dosya bulunamadi."
        print(json.dumps(result, ensure_ascii=False))
        return

    suffix = target.suffix.lower()

    try:
        if suffix in {".txt", ".md", ".json", ".xml", ".csv", ".html", ".htm"}:
            text = read_text_file(target)
            result["status"] = "extracted" if normalize_text(text) else "empty"
            result["sourceType"] = "plain_text"
            result["text"] = normalize_text(text)[: args.max_chars]
        elif suffix in {".udf", ".zip", ".docx"} and zipfile.is_zipfile(target):
            text, source_type = extract_zip_text(target)
            result["status"] = "extracted" if normalize_text(text) else "empty"
            result["sourceType"] = source_type
            result["text"] = normalize_text(text)[: args.max_chars]
        elif suffix == ".pdf":
            text = extract_pdf_text(target)
            result["status"] = "extracted" if normalize_text(text) else "empty"
            result["sourceType"] = "pdf_text"
            result["text"] = normalize_text(text)[: args.max_chars]
        elif suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff", ".heic", ".heif"}:
            text, source_type = extract_image_text_with_anthropic(target)
            result["status"] = "extracted" if normalize_text(text) else "empty"
            result["sourceType"] = source_type
            result["text"] = normalize_text(text)[: args.max_chars]
        else:
            result["status"] = "unsupported"
            result["sourceType"] = f"unsupported:{suffix or 'noext'}"
    except Exception as exc:
        result["status"] = "error"
        result["error"] = str(exc)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

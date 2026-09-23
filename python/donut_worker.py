"""Persistent local Donut worker for AdamCodd/donut-receipts-extract.

Speaks one JSON object per line on stdin/stdout. The receipt image never leaves
this process, and this process never calls the LLM.
"""
import json
import os
import sys
import traceback

UNREADABLE = (
    "We couldn't read this receipt. The photo may be blurry, too dark, cropped, "
    "or not a receipt. Take a clearer photo with the whole receipt in frame, "
    "or enter the expense manually."
)


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def load_model():
    model_id = os.environ.get("DONUT_MODEL_ID", "AdamCodd/donut-receipts-extract")
    import torch
    from transformers import DonutProcessor, VisionEncoderDecoderModel

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    processor = DonutProcessor.from_pretrained(model_id)
    model = VisionEncoderDecoderModel.from_pretrained(model_id)
    model.to(device)
    model.eval()
    return processor, model, device


def decode_sequence(processor, generated):
    decoded = processor.batch_decode(generated.sequences)[0]
    for token in (processor.tokenizer.eos_token, processor.tokenizer.pad_token):
        if token:
            decoded = decoded.replace(token, "")
    return decoded.strip()


def run_inference(processor, model, device, image_path, task_prompt):
    import torch
    from PIL import Image, UnidentifiedImageError

    try:
        image = Image.open(image_path).convert("RGB")
    except (UnidentifiedImageError, OSError):
        return {
            "ok": False,
            "code": "UNREADABLE_RECEIPT",
            "message": "This image could not be opened. Use a clearer JPG or PNG photo of the receipt, or enter the expense manually.",
        }

    if image.width < 32 or image.height < 32:
        return {
            "ok": False,
            "code": "UNREADABLE_RECEIPT",
            "message": UNREADABLE,
        }

    pixel_values = processor(image, return_tensors="pt").pixel_values.to(device)
    decoder_input_ids = processor.tokenizer(
        task_prompt,
        add_special_tokens=False,
        return_tensors="pt",
    ).input_ids.to(device)

    with torch.no_grad():
        generated = model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_length=model.decoder.config.max_position_embeddings,
            pad_token_id=processor.tokenizer.pad_token_id,
            eos_token_id=processor.tokenizer.eos_token_id,
            early_stopping=True,
            bad_words_ids=[[processor.tokenizer.unk_token_id]],
            return_dict_in_generate=True,
        )

    sequence = decode_sequence(processor, generated)
    if "<s_" not in sequence:
        return {
            "ok": False,
            "code": "UNREADABLE_RECEIPT",
            "message": UNREADABLE,
        }
    return {"ok": True, "sequence": sequence}


def main():
    task_prompt = os.environ.get("DONUT_TASK_PROMPT", "<s_receipt>")
    try:
        processor, model, device = load_model()
    except Exception as exc:
        detail = str(exc).lower()
        if any(token in detail for token in ("gated", "401", "403", "unauthorized", "access")):
            message = (
                "The Donut receipt model could not be downloaded. "
                "AdamCodd/donut-receipts-extract is access-gated: accept it on Hugging Face "
                "and set HF_TOKEN. You can still add this expense manually."
            )
        elif isinstance(exc, ModuleNotFoundError):
            message = (
                "The local receipt model is not installed. "
                "Install PetApp-BE/python/requirements.txt, then try again. "
                "You can still add this expense manually."
            )
        else:
            message = (
                "The local receipt model failed to load. "
                "You can still add this expense manually."
            )
            traceback.print_exc(file=sys.stderr)
        emit({"ready": False, "code": "MODEL_UNAVAILABLE", "message": message})
        return 1

    emit({"ready": True, "prompt": task_prompt})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            emit({
                "ok": False,
                "code": "RECEIPT_SCAN_FAILED",
                "message": "Receipt scanning failed. Please try again or enter the expense manually.",
            })
            continue

        request_id = request.get("id")
        image_path = request.get("imagePath")
        try:
            result = run_inference(processor, model, device, image_path, task_prompt)
            result["id"] = request_id
            emit(result)
        except Exception:
            traceback.print_exc(file=sys.stderr)
            emit({
                "id": request_id,
                "ok": False,
                "code": "RECEIPT_SCAN_FAILED",
                "message": "Receipt scanning failed. Please try again or enter the expense manually.",
            })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# transformers-js Extension

This extension exposes Hugging Face Transformers.js pipelines as pi tools for image and audio workflows.

## References

- Transformers.js docs: https://huggingface.co/docs/transformers.js/index
- Transformers.js site: https://huggingface.github.io/transformers.js/
- Browse compatible models: https://huggingface.co/models?library=transformers.js

## Tools

### Vision

| Tool                                | Default Model                               | Description                              |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------- |
| `ml-image-classification`           | `Xenova/vit-base-patch16-224`               | Classify images using transformer models |
| `ml-image-segmentation`             | `Xenova/detr-resnet-50-panoptic`            | Segment images into labeled regions      |
| `ml-background-removal`             | `briaai/RMBG-2.0`                           | Remove backgrounds from images           |
| `ml-depth-estimation`               | `depth-anything/Depth-Anything-V2-Small-hf` | Generate depth maps from images          |
| `ml-image-to-text`                  | `Salesforce/blip-image-captioning-base`     | Generate captions/text from images       |
| `ml-document-question-answering`    | `Xenova/donut-base-finetuned-docvqa`        | Answer questions about document images   |
| `ml-zero-shot-image-classification` | `openai/clip-vit-large-patch14`             | Classify images with custom labels       |
| `ml-object-detection`               | `facebook/detr-resnet-50`                   | Detect objects with bounding boxes       |
| `ml-zero-shot-object-detection`     | `Xenova/owlvit-base-patch32`                | Detect objects with custom labels        |

### Audio

| Tool                                | Default Model                                                  | Description                               |
| ----------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `ml-audio-classification`           | `Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech` | Classify audio (e.g., gender recognition) |
| `ml-zero-shot-audio-classification` | `Xenova/clap-htsat-unfused`                                    | Classify audio with custom labels         |
| `ml-automatic-speech-recognition`   | `onnx-community/whisper-large-v3-turbo`                        | Transcribe speech to text (Whisper)       |
| `ml-text-to-speech`                 | `Xenova/speecht5_tts`                                          | Generate speech from text                 |

## Alternative Models

All models can be overridden via the `model` parameter. Below are popular alternatives:

### Image Classification

| Model                                  | Description                   |
| -------------------------------------- | ----------------------------- |
| `Xenova/vit-base-patch16-224`          | ViT base model (default)      |
| `google/vit-base-patch16-224`          | Google's ViT base             |
| `apple/mobilevit-small`                | Apple MobileViT (lightweight) |
| `timm/mobilenetv3_small_100.lamb_in1k` | MobileNetV3 small             |
| `timm/resnet50.a1_in1k`                | ResNet-50                     |
| `Falconsai/nsfw_image_detection`       | NSFW detection                |
| `dima806/fairface_age_image_detection` | Age detection                 |

### Object Detection

| Model                                   | Description              |
| --------------------------------------- | ------------------------ |
| `facebook/detr-resnet-50`               | DETR ResNet-50 (default) |
| `Xenova/yolos-tiny`                     | YOLOS tiny (fast)        |
| `hustvl/yolos-small`                    | YOLOS small              |
| `PekingU/rtdetr_r50vd_coco_o365`        | RT-DETR (real-time)      |
| `microsoft/table-transformer-detection` | Table detection          |

### Image Segmentation

| Model                                                 | Description             |
| ----------------------------------------------------- | ----------------------- |
| `Xenova/detr-resnet-50-panoptic`                      | DETR panoptic (default) |
| `Xenova/segformer-b0-finetuned-ade-512-512`           | SegFormer B0            |
| `nvidia/segformer-b0-finetuned-ade-512-512`           | NVIDIA SegFormer B0     |
| `nvidia/segformer-b1-finetuned-ade-512-512`           | NVIDIA SegFormer B1     |
| `facebook/mask2former-swin-large-cityscapes-semantic` | Mask2Former             |
| `mattmdjaga/segformer_b2_clothes`                     | Clothing segmentation   |
| `jonathandinu/face-parsing`                           | Face parsing            |

### Background Removal

| Model                 | Description          |
| --------------------- | -------------------- |
| `briaai/RMBG-2.0`     | RMBG 2.0 (default)   |
| `briaai/RMBG-1.4`     | RMBG 1.4             |
| `Xenova/modnet`       | MODNet (lightweight) |
| `ZhengPeng7/BiRefNet` | BiRefNet             |

### Depth Estimation

| Model                                       | Description                       |
| ------------------------------------------- | --------------------------------- |
| `depth-anything/Depth-Anything-V2-Small-hf` | Depth Anything V2 small (default) |
| `Xenova/dpt-hybrid-midas`                   | DPT Hybrid MiDaS                  |
| `Intel/zoedepth-nyu-kitti`                  | ZoeDepth                          |
| `LiheYoung/depth-anything-large-hf`         | Depth Anything large              |
| `depth-anything/Depth-Anything-V2-Base-hf`  | Depth Anything V2 base            |
| `depth-anything/Depth-Anything-V2-Large-hf` | Depth Anything V2 large           |

### Image Captioning (Image-to-Text)

| Model                                    | Description            |
| ---------------------------------------- | ---------------------- |
| `Salesforce/blip-image-captioning-base`  | BLIP base (default)    |
| `Salesforce/blip-image-captioning-large` | BLIP large             |
| `Xenova/vit-gpt2-image-captioning`       | ViT-GPT2 (lightweight) |
| `microsoft/trocr-large-printed`          | TrOCR (OCR)            |

### Document Question Answering

| Model                                        | Description            |
| -------------------------------------------- | ---------------------- |
| `Xenova/donut-base-finetuned-docvqa`         | Donut DocVQA (default) |
| `naver-clova-ix/donut-base-finetuned-docvqa` | Donut original         |
| `impira/layoutlm-document-qa`                | LayoutLM               |
| `impira/layoutlm-invoices`                   | LayoutLM for invoices  |

### Zero-Shot Image Classification

| Model                               | Description             |
| ----------------------------------- | ----------------------- |
| `openai/clip-vit-large-patch14`     | CLIP ViT-L/14 (default) |
| `Xenova/clip-vit-base-patch32`      | CLIP ViT-B/32 (fast)    |
| `Xenova/clip-vit-base-patch16`      | CLIP ViT-B/16           |
| `openai/clip-vit-large-patch14-336` | CLIP ViT-L/14 high-res  |
| `google/siglip-so400m-patch14-384`  | SigLIP                  |
| `patrickjohncyh/fashion-clip`       | Fashion CLIP            |

### Speech Recognition (ASR)

| Model                                   | Description                            |
| --------------------------------------- | -------------------------------------- |
| `onnx-community/whisper-large-v3-turbo` | Whisper large v3 turbo (default, best) |
| `openai/whisper-large-v3`               | Whisper large v3                       |
| `Xenova/whisper-small`                  | Whisper small                          |
| `Xenova/whisper-base`                   | Whisper base                           |
| `Xenova/whisper-tiny.en`                | Whisper tiny English (fastest)         |
| `Xenova/whisper-tiny`                   | Whisper tiny multilingual              |

### Audio Classification

| Model                                                          | Description                   |
| -------------------------------------------------------------- | ----------------------------- |
| `Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech` | Gender recognition (default)  |
| `MIT/ast-finetuned-audioset-10-10-0.4593`                      | Audio Spectrogram Transformer |
| `speechbrain/emotion-recognition-wav2vec2-IEMOCAP`             | Emotion recognition           |
| `speechbrain/lang-id-voxlingua107-ecapa`                       | Language identification       |
| `audeering/wav2vec2-large-robust-24-ft-age-gender`             | Age & gender                  |

### Zero-Shot Audio Classification

| Model                       | Description      |
| --------------------------- | ---------------- |
| `Xenova/clap-htsat-unfused` | CLAP (default)   |
| `laion/clap-htsat-fused`    | LAION CLAP fused |

### Text-to-Speech

| Model                        | Description        |
| ---------------------------- | ------------------ |
| `Xenova/speecht5_tts`        | SpeechT5 (default) |
| `Xenova/mms-tts-eng`         | MMS TTS English    |
| `myshell-ai/MeloTTS-English` | MeloTTS English    |
| `myshell-ai/MeloTTS-Spanish` | MeloTTS Spanish    |

## Audio Processing

Audio tools support both local files and URLs. Audio is automatically preprocessed:

- Converted to 32-bit float format
- Resampled to 16kHz (required by speech models)
- Stereo channels merged to mono

Supported format: WAV files (uses `wavefile` package for Node.js compatibility).

## Usage

Tools are registered when the extension loads. Each tool accepts the parameters defined in `index.ts` and returns a text result plus structured details.

Example (speech recognition):

```ts
const result = await tool.execute(
  "call",
  { audio: "/path/to/audio.wav" },
  undefined,
  onUpdate,
  ctx,
);
// result.content[0].text: " And so my fellow Americans..."
```

Example (object detection with custom model):

```ts
const result = await tool.execute(
  "call",
  {
    image: "/path/to/image.png",
    model: "Xenova/yolos-tiny", // Use faster model
    threshold: 0.4,
  },
  undefined,
  onUpdate,
  ctx,
);
```

## Notes

- Pipelines are cached per task/model to avoid reloading models.
- First use of a model can be slow; the tool emits an update during load.
- Some tools attach images to the response content when available.
- Text-to-speech returns base64-encoded WAV data in tool details.
- Audio processing uses `wavefile` since `AudioContext` is not available in Node.js.
- Models prefixed with `Xenova/` are optimized for transformers.js.

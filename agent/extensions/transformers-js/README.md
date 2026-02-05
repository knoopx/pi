# Transformers.js Extension

Run machine learning models locally using [Transformers.js](https://huggingface.co/docs/transformers.js). This extension provides vision and audio processing tools that work entirely on your CPU - no GPU or cloud API required.

## Features

- **13 ML Tools** covering image and audio processing
- **82 Verified Models** that work out of the box
- **Lazy Loading** - models only download when first used
- **Cached Pipelines** - subsequent calls reuse loaded models
- **Quantized Models** - optimized for CPU inference (q8)

## Available Tools

| Tool                                | Description                         | Default Model        |
| ----------------------------------- | ----------------------------------- | -------------------- |
| `ml-image-classification`           | Classify images into categories     | ViT base             |
| `ml-image-segmentation`             | Segment images into labeled regions | DETR panoptic        |
| `ml-background-removal`             | Remove backgrounds from images      | MODNet               |
| `ml-depth-estimation`               | Generate depth maps                 | Depth Anything small |
| `ml-image-to-text`                  | Caption images or OCR               | ViT-GPT2             |
| `ml-document-question-answering`    | Answer questions about documents    | Donut DocVQA         |
| `ml-zero-shot-image-classification` | Classify with custom labels         | CLIP B/32            |
| `ml-object-detection`               | Detect objects with bounding boxes  | YOLOS tiny           |
| `ml-zero-shot-object-detection`     | Detect custom object classes        | OWL-ViT B/32         |
| `ml-audio-classification`           | Classify audio clips                | Wav2Vec2 gender      |
| `ml-zero-shot-audio-classification` | Classify audio with custom labels   | CLAP                 |
| `ml-automatic-speech-recognition`   | Transcribe speech to text           | Whisper tiny.en      |
| `ml-text-to-speech`                 | Generate speech from text           | MMS TTS English      |

## Verified Models

All models below have been tested and confirmed working. Pass any model ID to the `model` parameter.

### Image Classification (13 models)

| Model                                                        | Description           |
| ------------------------------------------------------------ | --------------------- |
| `Xenova/vit-base-patch16-224`                                | ViT base (default)    |
| `Xenova/mobilevit-small`                                     | MobileViT small       |
| `onnx-community/mobilenet_v2_1.0_224`                        | MobileNet V2          |
| `Xenova/resnet-50`                                           | ResNet-50             |
| `Xenova/resnet-18`                                           | ResNet-18             |
| `Xenova/swin-tiny-patch4-window7-224`                        | Swin tiny             |
| `Xenova/convnext-tiny-224`                                   | ConvNeXt tiny         |
| `onnx-community/dinov2-with-registers-small-with-attentions` | DINOv2 small          |
| `AdamCodd/vit-base-nsfw-detector`                            | NSFW detector         |
| `Xenova/facial_emotions_image_detection`                     | Facial emotions       |
| `onnx-community/fairface_age_image_detection-ONNX`           | Age detection         |
| `onnx-community/gender-classification-ONNX`                  | Gender classification |
| `onnx-community/swin-finetuned-food101-ONNX`                 | Food-101 classifier   |

### Image Segmentation (8 models)

| Model                                                | Description              |
| ---------------------------------------------------- | ------------------------ |
| `Xenova/detr-resnet-50-panoptic`                     | DETR panoptic (default)  |
| `Xenova/segformer-b0-finetuned-ade-512-512`          | SegFormer B0 ADE         |
| `Xenova/segformer-b2-finetuned-ade-512-512`          | SegFormer B2 ADE         |
| `Xenova/segformer-b2-finetuned-cityscapes-1024-1024` | SegFormer B2 Cityscapes  |
| `Xenova/segformer_b2_clothes`                        | Clothing segmentation B2 |
| `Xenova/segformer_b0_clothes`                        | Clothing segmentation B0 |
| `jonathandinu/face-parsing`                          | Face parsing             |
| `Xenova/face-parsing`                                | Face parsing (Xenova)    |

### Background Removal (4 models)

| Model                       | Description             |
| --------------------------- | ----------------------- |
| `Xenova/modnet`             | MODNet (default)        |
| `briaai/RMBG-1.4`           | RMBG 1.4 (high quality) |
| `onnx-community/ormbg-ONNX` | Open RMBG               |
| `onnx-community/ISNet-ONNX` | ISNet                   |

### Depth Estimation (5 models)

| Model                            | Description                    |
| -------------------------------- | ------------------------------ |
| `Xenova/depth-anything-small-hf` | Depth Anything small (default) |
| `Xenova/depth-anything-base-hf`  | Depth Anything base            |
| `Xenova/glpn-kitti`              | GLPN KITTI                     |
| `Xenova/glpn-nyu`                | GLPN NYU                       |
| `onnx-community/DepthPro-ONNX`   | Apple DepthPro                 |

### Image to Text (5 models)

| Model                              | Description                   |
| ---------------------------------- | ----------------------------- |
| `Xenova/vit-gpt2-image-captioning` | ViT-GPT2 captioning (default) |
| `Xenova/trocr-small-printed`       | TrOCR small printed           |
| `Xenova/trocr-base-printed`        | TrOCR base printed            |
| `Xenova/trocr-small-handwritten`   | TrOCR small handwritten       |
| `Xenova/trocr-base-handwritten`    | TrOCR base handwritten        |

### Document Question Answering (1 model)

| Model                                | Description            |
| ------------------------------------ | ---------------------- |
| `Xenova/donut-base-finetuned-docvqa` | Donut DocVQA (default) |

### Zero-Shot Image Classification (14 models)

| Model                                                    | Description              |
| -------------------------------------------------------- | ------------------------ |
| `Xenova/clip-vit-base-patch32`                           | CLIP B/32 (default)      |
| `Xenova/clip-vit-base-patch16`                           | CLIP B/16                |
| `Xenova/clip-vit-large-patch14`                          | CLIP L/14                |
| `Xenova/clip-vit-large-patch14-336`                      | CLIP L/14 336px          |
| `Xenova/chinese-clip-vit-base-patch16`                   | Chinese CLIP B/16        |
| `Xenova/chinese-clip-vit-large-patch14`                  | Chinese CLIP L/14        |
| `Xenova/chinese-clip-vit-large-patch14-336px`            | Chinese CLIP L/14 336px  |
| `Xenova/siglip-base-patch16-224`                         | SigLIP base 224          |
| `Xenova/siglip-base-patch16-256`                         | SigLIP base 256          |
| `Xenova/siglip-base-patch16-384`                         | SigLIP base 384          |
| `Xenova/siglip-base-patch16-512`                         | SigLIP base 512          |
| `Xenova/siglip-large-patch16-384`                        | SigLIP large 384         |
| `onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX` | TinyCLIP 8M              |
| `onnx-community/StreetCLIP-ONNX`                         | StreetCLIP (geolocation) |

### Object Detection (2 models)

| Model                   | Description          |
| ----------------------- | -------------------- |
| `Xenova/yolos-tiny`     | YOLOS tiny (default) |
| `Xenova/detr-resnet-50` | DETR ResNet-50       |

### Zero-Shot Object Detection (2 models)

| Model                        | Description            |
| ---------------------------- | ---------------------- |
| `Xenova/owlvit-base-patch32` | OWL-ViT B/32 (default) |
| `Xenova/owlvit-base-patch16` | OWL-ViT B/16           |

### Audio Classification (1 model)

| Model                                                          | Description                  |
| -------------------------------------------------------------- | ---------------------------- |
| `Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech` | Gender recognition (default) |

### Zero-Shot Audio Classification (1 model)

| Model                       | Description            |
| --------------------------- | ---------------------- |
| `Xenova/clap-htsat-unfused` | CLAP unfused (default) |

### Automatic Speech Recognition (21 models)

| Model                                               | Description                               |
| --------------------------------------------------- | ----------------------------------------- |
| `Xenova/whisper-tiny.en`                            | Whisper tiny.en (default)                 |
| `Xenova/whisper-base.en`                            | Whisper base.en                           |
| `Xenova/whisper-small.en`                           | Whisper small.en                          |
| `Xenova/whisper-medium.en`                          | Whisper medium.en                         |
| `Xenova/whisper-base`                               | Whisper base (multilingual)               |
| `Xenova/whisper-small`                              | Whisper small (multilingual)              |
| `Xenova/whisper-medium`                             | Whisper medium (multilingual)             |
| `Xenova/whisper-large`                              | Whisper large (multilingual)              |
| `Xenova/whisper-large-v3`                           | Whisper large v3                          |
| `onnx-community/whisper-tiny`                       | ONNX Whisper tiny                         |
| `onnx-community/whisper-tiny.en`                    | ONNX Whisper tiny.en                      |
| `onnx-community/whisper-base`                       | ONNX Whisper base                         |
| `onnx-community/whisper-small`                      | ONNX Whisper small                        |
| `onnx-community/whisper-large-v3-turbo`             | ONNX Whisper large v3 turbo               |
| `onnx-community/whisper-tiny_timestamped`           | ONNX Whisper tiny (timestamped)           |
| `onnx-community/whisper-base_timestamped`           | ONNX Whisper base (timestamped)           |
| `onnx-community/whisper-small_timestamped`          | ONNX Whisper small (timestamped)          |
| `onnx-community/whisper-large-v3-turbo_timestamped` | ONNX Whisper large v3 turbo (timestamped) |
| `distil-whisper/distil-small.en`                    | Distil-Whisper small.en                   |
| `distil-whisper/distil-medium.en`                   | Distil-Whisper medium.en                  |
| `distil-whisper/distil-large-v2`                    | Distil-Whisper large v2                   |

### Text to Speech (5 models)

| Model                | Description               |
| -------------------- | ------------------------- |
| `Xenova/mms-tts-eng` | MMS TTS English (default) |
| `Xenova/mms-tts-spa` | MMS TTS Spanish           |
| `Xenova/mms-tts-fra` | MMS TTS French            |
| `Xenova/mms-tts-deu` | MMS TTS German            |
| `Xenova/mms-tts-por` | MMS TTS Portuguese        |

## Usage Examples

### Image Classification

```typescript
// Default model
ml - image - classification({ image: "photo.jpg" });

// Specific model
ml -
  image -
  classification({
    image: "photo.jpg",
    model: "onnx-community/swin-finetuned-food101-ONNX",
  });
```

### Zero-Shot Classification

```typescript
ml -
  zero -
  shot -
  image -
  classification({
    image: "photo.jpg",
    labels: ["cat", "dog", "bird", "fish"],
  });
```

### Speech Recognition

```typescript
// English (fastest)
ml - automatic - speech - recognition({ audio: "recording.wav" });

// Large model for best accuracy
ml -
  automatic -
  speech -
  recognition({
    audio: "recording.wav",
    model: "onnx-community/whisper-large-v3-turbo",
  });

// With timestamps
ml -
  automatic -
  speech -
  recognition({
    audio: "recording.wav",
    model: "onnx-community/whisper-base_timestamped",
    returnTimestamps: true,
  });
```

### Text to Speech

```typescript
ml - text - to - speech({ text: "Hello, world!" });
// Returns base64-encoded WAV audio in details.audioBase64
```

## Verification

Run the model verification script to test all models:

```bash
# Quick test (default models only)
bun run verify:quick

# Full verification (all 82 models)
bun run verify
```

## Notes

- First use of a model downloads it (~50MB-500MB depending on model)
- Models are cached in `~/.cache/huggingface/`
- All models run on CPU with 8-bit quantization
- Some models may take 10-30+ seconds on first inference

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";

import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

// Lazy import transformers to avoid loading at startup
let transformersModule: typeof import("@huggingface/transformers") | null =
  null;

async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import("@huggingface/transformers");
  }
  return transformersModule;
}

// Pipeline cache to avoid re-initializing models
const pipelineCache = new Map<string, unknown>();

async function getPipeline<T>(
  task: string,
  model?: string,
  onUpdate?: AgentToolUpdateCallback,
): Promise<T> {
  const cacheKey = `${task}:${model || "default"}`;

  if (pipelineCache.has(cacheKey)) {
    return pipelineCache.get(cacheKey) as T;
  }

  onUpdate?.({
    content: [
      {
        type: "text",
        text: `Loading ${task} model${model ? ` (${model})` : ""}... This may take a moment on first use.`,
      },
    ],
    details: { task, model, status: "loading" },
  });

  const { pipeline } = await getTransformers();
  const pipe = await pipeline(task as Parameters<typeof pipeline>[0], model, {
    dtype: "q8",
    device: "cpu",
  });

  pipelineCache.set(cacheKey, pipe);
  return pipe as T;
}

type ToolContent = TextContent | ImageContent;

type RawImageData = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
};

type RawAudioLike = {
  toWav: () => ArrayBuffer;
  sampling_rate: number;
  audio: Float32Array;
};

type TensorLike = {
  dims?: number[];
  size?: number;
  type?: string;
  data?: ArrayLike<number>;
};

type RawImageLike = {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
};

async function rawImageToContent(
  image: unknown,
): Promise<ImageContent | TextContent> {
  // Return text description - image transformation requires browser APIs
  const rawImage = image as RawImageData;
  return {
    type: "text",
    text: `[Image: ${rawImage.width}x${rawImage.height}, ${rawImage.channels} channels]`,
  };
}

async function rawAudioToBase64(audio: RawAudioLike): Promise<string> {
  return Buffer.from(audio.toWav()).toString("base64");
}

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
}

function contentResult(
  content: ToolContent[],
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  return { content, details };
}

function errorResult(
  error: unknown,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { ...details, error: message },
  };
}

async function loadImage(source: string): Promise<unknown> {
  const { RawImage } = await getTransformers();
  const rawImage = RawImage as {
    read: (path: string) => Promise<unknown>;
  };

  // RawImage.read() works for both URLs and local file paths
  return rawImage.read(source);
}

async function loadAudio(source: string): Promise<Float32Array> {
  // Dynamically import wavefile
  const wavefile = await import("wavefile");

  // Load audio data from URL or local file
  let buffer: Buffer;
  if (source.startsWith("http://") || source.startsWith("https://")) {
    const response = await fetch(source);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    buffer = await readFile(source);
  }

  // Read .wav file and convert to required format
  const wav = new wavefile.WaveFile(buffer);
  wav.toBitDepth("32f"); // Pipeline expects input as Float32Array
  wav.toSampleRate(16000); // Whisper expects 16kHz sampling rate

  let audioData = wav.getSamples() as unknown as Float32Array | Float32Array[];

  // Handle stereo audio - merge channels
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);
      // Merge channels into first channel
      for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] =
          (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
      }
    }
    // Select first channel
    audioData = audioData[0];
  }

  return audioData;
}

function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function normalizeArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function normalizeNestedArray<T>(value: T | T[] | T[][]): T[] {
  if (!Array.isArray(value)) {
    return [value];
  }
  return value.flat() as T[];
}

const ImageInputParams = {
  image: Type.String({
    description: "Image URL or local file path to analyze",
  }),
  model: Type.Optional(
    Type.String({
      description: "Model ID to use",
    }),
  ),
};

const ObjectDetectionParams = Type.Object({
  ...ImageInputParams,
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/yolos-tiny)",
    }),
  ),
  threshold: Type.Optional(
    Type.Number({
      description: "Minimum confidence threshold (default: 0.3)",
    }),
  ),
});

const ImageClassificationParams = Type.Object({
  ...ImageInputParams,
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/vit-base-patch16-224)",
    }),
  ),
  topK: Type.Optional(
    Type.Number({
      description: "Number of top labels to return",
    }),
  ),
});

const ImageSegmentationParams = Type.Object({
  ...ImageInputParams,
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/detr-resnet-50-panoptic)",
    }),
  ),
});

const BackgroundRemovalParams = Type.Object({
  ...ImageInputParams,
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/modnet)",
    }),
  ),
});

const DepthEstimationParams = Type.Object({
  ...ImageInputParams,
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/depth-anything-small-hf)",
    }),
  ),
});

const ImageToTextParams = Type.Object({
  ...ImageInputParams,
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/vit-gpt2-image-captioning)",
    }),
  ),
});

const DocumentQuestionAnsweringParams = Type.Object({
  ...ImageInputParams,
  question: Type.String({
    description: "Question to answer from the document image",
  }),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/donut-base-finetuned-docvqa)",
    }),
  ),
});

const ZeroShotImageClassificationParams = Type.Object({
  ...ImageInputParams,
  labels: Type.Array(Type.String(), {
    description: "Candidate labels for classification",
  }),
  hypothesisTemplate: Type.Optional(
    Type.String({
      description: "Hypothesis template for labels",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/clip-vit-base-patch32)",
    }),
  ),
});

const ZeroShotObjectDetectionParams = Type.Object({
  ...ImageInputParams,
  labels: Type.Array(Type.String(), {
    description: "Candidate labels for detection",
  }),
  threshold: Type.Optional(
    Type.Number({
      description: "Minimum confidence threshold (default: 0.1)",
    }),
  ),
  topK: Type.Optional(
    Type.Number({
      description: "Top K detections to return",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/owlvit-base-patch32)",
    }),
  ),
});

const AudioClassificationParams = Type.Object({
  audio: Type.String({
    description: "Audio URL or local file path to analyze",
  }),
  model: Type.Optional(
    Type.String({
      description:
        "Model ID (default: Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech)",
    }),
  ),
  topK: Type.Optional(
    Type.Number({
      description: "Number of top labels to return",
    }),
  ),
});

const ZeroShotAudioClassificationParams = Type.Object({
  audio: Type.String({
    description: "Audio URL or local file path to analyze",
  }),
  labels: Type.Array(Type.String(), {
    description: "Candidate labels for classification",
  }),
  hypothesisTemplate: Type.Optional(
    Type.String({
      description: "Hypothesis template for labels",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/clap-htsat-unfused)",
    }),
  ),
});

const AutomaticSpeechRecognitionParams = Type.Object({
  audio: Type.String({
    description: "Audio URL or local file path to transcribe",
  }),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/whisper-tiny.en)",
    }),
  ),
  returnTimestamps: Type.Optional(
    Type.Union([
      Type.Boolean({ description: "Return timestamps" }),
      Type.Literal("word"),
    ]),
  ),
  language: Type.Optional(Type.String({ description: "Source language" })),
  task: Type.Optional(
    Type.String({ description: "Task (transcribe or translate)" }),
  ),
});

const TextToSpeechParams = Type.Object({
  text: Type.String({
    description: "Text to synthesize",
  }),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/mms-tts-eng)",
    }),
  ),
  speakerEmbeddings: Type.Optional(
    Type.String({
      description: "Optional speaker embeddings URL or path",
    }),
  ),
  speed: Type.Optional(
    Type.Number({
      description: "Playback speed",
    }),
  ),
});

// Type definitions

type ObjectDetectionParamsType = Static<typeof ObjectDetectionParams>;
type ImageClassificationParamsType = Static<typeof ImageClassificationParams>;
type ImageSegmentationParamsType = Static<typeof ImageSegmentationParams>;
type BackgroundRemovalParamsType = Static<typeof BackgroundRemovalParams>;
type DepthEstimationParamsType = Static<typeof DepthEstimationParams>;
type ImageToTextParamsType = Static<typeof ImageToTextParams>;
type DocumentQuestionAnsweringParamsType = Static<
  typeof DocumentQuestionAnsweringParams
>;
type ZeroShotImageClassificationParamsType = Static<
  typeof ZeroShotImageClassificationParams
>;
type ZeroShotObjectDetectionParamsType = Static<
  typeof ZeroShotObjectDetectionParams
>;
type AudioClassificationParamsType = Static<typeof AudioClassificationParams>;
type ZeroShotAudioClassificationParamsType = Static<
  typeof ZeroShotAudioClassificationParams
>;
type AutomaticSpeechRecognitionParamsType = Static<
  typeof AutomaticSpeechRecognitionParams
>;
type TextToSpeechParamsType = Static<typeof TextToSpeechParams>;

// Pipeline result types
interface ClassificationResult {
  label: string;
  score: number;
}

interface ObjectDetectionResult {
  score: number;
  label: string;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

interface ImageSegmentationResult {
  label?: string | null;
  score?: number | null;
  mask: RawImageLike;
}

interface ImageToTextResult {
  generated_text: string;
}

interface DocumentQuestionAnsweringResult {
  answer: string;
}

interface DepthEstimationResult {
  predicted_depth?: TensorLike;
  depth: RawImageLike;
}

interface AutomaticSpeechRecognitionResult {
  text: string;
  chunks?: { text: string; timestamp: [number, number] }[];
}

export default function transformersJsExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "ml-image-classification",
    label: "ML Image Classification",
    description: `Classify an image using a transformer model.

Use this to:
- Assign labels to images
- Detect the most likely classes

Returns labels with confidence scores.

Alternative models:
- Xenova/mobilevit-small (lightweight)
- Xenova/resnet-50 (ResNet-50)
- Xenova/resnet-18 (ResNet-18)
- onnx-community/mobilenet_v2_1.0_224 (MobileNet)
- AdamCodd/vit-base-nsfw-detector (NSFW)
- onnx-community/fairface_age_image_detection-ONNX (age)
- onnx-community/gender-classification-ONNX (gender)
- Xenova/facial_emotions_image_detection (emotions)
- onnx-community/swin-finetuned-food101-ONNX (Food-101)`,
    parameters: ImageClassificationParams,

    async execute(
      _toolCallId: string,
      params: ImageClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, model, topK } = params;
        const classifier = await getPipeline<
          (
            input: unknown,
            options?: { top_k?: number },
          ) => Promise<ClassificationResult[]>
        >(
          "image-classification",
          model || "Xenova/vit-base-patch16-224",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = await classifier(
          input,
          topK !== undefined ? { top_k: topK } : undefined,
        );
        const output = normalizeArray(results);

        const resultText = output
          .map((result) => `${result.label}: ${formatScore(result.score)}`)
          .join("\n");

        return textResult(resultText || "No classifications returned.", {
          image,
          results: output,
        });
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-image-segmentation",
    label: "ML Image Segmentation",
    description: `Segment an image into labeled regions.

Use this to:
- Extract object masks
- Identify distinct segments

Returns segment labels, scores, and mask images.

Alternative models:
- Xenova/segformer-b0-finetuned-ade-512-512 (SegFormer B0)
- Xenova/segformer-b2-finetuned-ade-512-512 (SegFormer B2)
- Xenova/segformer-b2-finetuned-cityscapes-1024-1024 (Cityscapes)
- Xenova/segformer_b2_clothes (clothing)
- Xenova/face-parsing (faces)`,
    parameters: ImageSegmentationParams,

    async execute(
      _toolCallId: string,
      params: ImageSegmentationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, model } = params;
        const segmenter = await getPipeline<
          (input: unknown) => Promise<ImageSegmentationResult[]>
        >(
          "image-segmentation",
          model || "Xenova/detr-resnet-50-panoptic",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = await segmenter(input);

        if (!results.length) {
          return textResult("No segments detected.", { image, results: [] });
        }

        const summary = results
          .map(
            (segment, index) =>
              `${index + 1}. ${segment.label ?? "unknown"} (${formatScore(
                segment.score ?? 0,
              )})`,
          )
          .join("\n");

        const masks = await Promise.all(
          results.map((segment) => rawImageToContent(segment.mask)),
        );

        return contentResult([{ type: "text", text: summary }, ...masks], {
          image,
          segments: results,
        });
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-background-removal",
    label: "ML Background Removal",
    description: `Remove backgrounds from an image.

Use this to:
- Isolate a subject
- Generate transparent background images

Returns the processed image(s).

Alternative models:
- Xenova/modnet (lightweight, default)
- briaai/RMBG-1.4 (high quality)
- onnx-community/ormbg-ONNX (Open RMBG)
- onnx-community/ISNet-ONNX (ISNet)`,
    parameters: BackgroundRemovalParams,

    async execute(
      _toolCallId: string,
      params: BackgroundRemovalParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, model } = params;
        const remover = await getPipeline<
          (input: unknown) => Promise<RawImageLike[]>
        >("background-removal", model || "Xenova/modnet", onUpdate);

        const input = await loadImage(image);
        const results = await remover(input);

        if (!results.length) {
          return textResult("No background removal output returned.", {
            image,
          });
        }

        const images = await Promise.all(
          results.map((result) => rawImageToContent(result)),
        );

        return contentResult(
          [
            {
              type: "text",
              text: `Background removal produced ${results.length} image(s).`,
            },
            ...images,
          ],
          { image, count: results.length },
        );
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-depth-estimation",
    label: "ML Depth Estimation",
    description: `Estimate depth for an image.

Use this to:
- Generate depth maps
- Analyze scene depth

Returns a depth image and metadata.

Alternative models:
- Xenova/depth-anything-small-hf (fast, default)
- Xenova/depth-anything-base-hf (balanced)
- Xenova/glpn-kitti (GLPN KITTI)
- Xenova/glpn-nyu (GLPN NYU)
- onnx-community/DepthPro-ONNX (Apple DepthPro)`,
    parameters: DepthEstimationParams,

    async execute(
      _toolCallId: string,
      params: DepthEstimationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, model } = params;
        const estimator = await getPipeline<
          (
            input: unknown,
          ) => Promise<DepthEstimationResult | DepthEstimationResult[]>
        >(
          "depth-estimation",
          model || "Xenova/depth-anything-small-hf",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = normalizeArray(await estimator(input));
        const result = results[0];
        const depthImage = await rawImageToContent(result.depth);

        return contentResult(
          [
            {
              type: "text",
              text: "Depth estimation completed.",
            },
            depthImage,
          ],
          {
            image,
            predictedDepth: {
              dims: result.predicted_depth?.dims,
              size: result.predicted_depth?.size,
              type: result.predicted_depth?.type,
            },
          },
        );
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-image-to-text",
    label: "ML Image-to-Text",
    description: `Generate text from an image.

Use this to:
- Caption images
- Perform OCR-like tasks

Returns generated text.

Alternative models:
- Xenova/vit-gpt2-image-captioning (captioning, default)
- Xenova/trocr-small-printed (OCR printed, fast)
- Xenova/trocr-base-printed (OCR printed)
- Xenova/trocr-small-handwritten (OCR handwritten, fast)
- Xenova/trocr-base-handwritten (OCR handwritten)`,
    parameters: ImageToTextParams,

    async execute(
      _toolCallId: string,
      params: ImageToTextParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, model } = params;
        const captioner = await getPipeline<
          (input: unknown) => Promise<ImageToTextResult | ImageToTextResult[]>
        >(
          "image-to-text",
          model || "Xenova/vit-gpt2-image-captioning",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = normalizeArray(await captioner(input));
        const text = results.map((result) => result.generated_text).join("\n");

        return textResult(text || "No text generated.", { image, results });
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-document-question-answering",
    label: "ML Document Question Answering",
    description: `Answer questions about document images.

Use this to:
- Extract information from documents
- Query invoices, forms, and scans

Returns answers extracted from the document.

Model: Xenova/donut-base-finetuned-docvqa (default)`,
    parameters: DocumentQuestionAnsweringParams,

    async execute(
      _toolCallId: string,
      params: DocumentQuestionAnsweringParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, question, model } = params;
        const qa = await getPipeline<
          (
            input: unknown,
            questionInput: string,
          ) => Promise<
            DocumentQuestionAnsweringResult | DocumentQuestionAnsweringResult[]
          >
        >(
          "document-question-answering",
          model || "Xenova/donut-base-finetuned-docvqa",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = normalizeArray(await qa(input, question));
        const answers = results.map((result) => result.answer).join("\n");

        return textResult(answers || "No answer returned.", {
          image,
          question,
          results,
        });
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-zero-shot-image-classification",
    label: "ML Zero-Shot Image Classification",
    description: `Classify images using custom labels without training.

Use this to:
- Apply your own labels to images
- Use CLIP-style zero-shot classification

Returns labels with confidence scores.

Alternative models:
- Xenova/clip-vit-base-patch32 (fast, default)
- Xenova/clip-vit-base-patch16 (CLIP B/16)
- Xenova/clip-vit-large-patch14 (CLIP L/14)
- Xenova/clip-vit-large-patch14-336 (high-res)
- Xenova/siglip-base-patch16-224 (SigLIP base)
- Xenova/siglip-large-patch16-384 (SigLIP large)
- Xenova/chinese-clip-vit-base-patch16 (Chinese)
- onnx-community/StreetCLIP-ONNX (geolocation)`,
    parameters: ZeroShotImageClassificationParams,

    async execute(
      _toolCallId: string,
      params: ZeroShotImageClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, labels, hypothesisTemplate, model } = params;
        const classifier = await getPipeline<
          (
            input: unknown,
            candidateLabels: string[],
            options?: { hypothesis_template?: string },
          ) => Promise<ClassificationResult[] | ClassificationResult[][]>
        >(
          "zero-shot-image-classification",
          model || "Xenova/clip-vit-base-patch32",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = await classifier(
          input,
          labels,
          hypothesisTemplate
            ? { hypothesis_template: hypothesisTemplate }
            : undefined,
        );
        const output = normalizeNestedArray<ClassificationResult>(results);

        const resultText = output
          .map((result) => `${result.label}: ${formatScore(result.score)}`)
          .join("\n");

        return textResult(resultText || "No classifications returned.", {
          image,
          labels,
          results: output,
        });
      } catch (error) {
        return errorResult(error, {
          image: params.image,
          labels: params.labels,
        });
      }
    },
  });

  pi.registerTool({
    name: "ml-object-detection",
    label: "ML Object Detection",
    description: `Detect objects in images using a transformer model.

Use this to:
- Find objects and bounding boxes in images
- Run YOLOS and other object detection models
- Analyze local images or URLs

Returns detected objects with confidence scores and bounding boxes.

Alternative models:
- Xenova/yolos-tiny (fast, default)
- Xenova/detr-resnet-50 (DETR ResNet-50)`,
    parameters: ObjectDetectionParams,

    async execute(
      _toolCallId: string,
      params: ObjectDetectionParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, model, threshold = 0.3 } = params;
        const detector = await getPipeline<
          (imageInput: unknown) => Promise<ObjectDetectionResult[]>
        >("object-detection", model || "Xenova/yolos-tiny", onUpdate);

        const input = await loadImage(image);
        const results = await detector(input);
        const filtered = results.filter((result) => result.score >= threshold);

        const resultText = (filtered.length ? filtered : results)
          .map(
            (result) =>
              `${result.label} ${formatScore(result.score)} ` +
              `(xmin: ${result.box.xmin.toFixed(1)}, ymin: ${result.box.ymin.toFixed(1)}, ` +
              `xmax: ${result.box.xmax.toFixed(1)}, ymax: ${result.box.ymax.toFixed(1)})`,
          )
          .join("\n");

        return textResult(resultText || "No objects detected.", {
          image,
          threshold,
          results,
        });
      } catch (error) {
        return errorResult(error, { image: params.image });
      }
    },
  });

  pi.registerTool({
    name: "ml-zero-shot-object-detection",
    label: "ML Zero-Shot Object Detection",
    description: `Detect objects in images using custom labels.

Use this to:
- Detect unseen object classes
- Provide custom detection labels

Returns detected objects with confidence scores and bounding boxes.

Alternative models:
- Xenova/owlvit-base-patch32 (fast, default)
- Xenova/owlvit-base-patch16 (OWL-ViT B/16)`,
    parameters: ZeroShotObjectDetectionParams,

    async execute(
      _toolCallId: string,
      params: ZeroShotObjectDetectionParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { image, labels, threshold = 0.1, topK, model } = params;
        const detector = await getPipeline<
          (
            input: unknown,
            candidateLabels: string[],
            options?: { threshold?: number; top_k?: number },
          ) => Promise<ObjectDetectionResult[] | ObjectDetectionResult[][]>
        >(
          "zero-shot-object-detection",
          model || "Xenova/owlvit-base-patch32",
          onUpdate,
        );

        const input = await loadImage(image);
        const results = await detector(
          input,
          labels,
          topK !== undefined ? { threshold, top_k: topK } : { threshold },
        );
        const output = normalizeNestedArray<ObjectDetectionResult>(results);
        const filtered = output.filter((result) => result.score >= threshold);

        const resultText = (filtered.length ? filtered : output)
          .map(
            (result) =>
              `${result.label} ${formatScore(result.score)} ` +
              `(xmin: ${result.box.xmin.toFixed(1)}, ymin: ${result.box.ymin.toFixed(1)}, ` +
              `xmax: ${result.box.xmax.toFixed(1)}, ymax: ${result.box.ymax.toFixed(1)})`,
          )
          .join("\n");

        return textResult(resultText || "No objects detected.", {
          image,
          labels,
          threshold,
          results: output,
        });
      } catch (error) {
        return errorResult(error, {
          image: params.image,
          labels: params.labels,
        });
      }
    },
  });

  pi.registerTool({
    name: "ml-audio-classification",
    label: "ML Audio Classification",
    description: `Classify audio using a transformer model.

Use this to:
- Label audio clips
- Detect acoustic events

Returns labels with confidence scores.

Model: Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech (gender recognition, default)`,
    parameters: AudioClassificationParams,

    async execute(
      _toolCallId: string,
      params: AudioClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { audio, model, topK } = params;
        const classifier = await getPipeline<
          (
            input: Float32Array,
            options?: { top_k?: number },
          ) => Promise<ClassificationResult[]>
        >(
          "audio-classification",
          model ||
            "Xenova/wav2vec2-large-xlsr-53-gender-recognition-librispeech",
          onUpdate,
        );

        const audioData = await loadAudio(audio);
        const results = await classifier(
          audioData,
          topK !== undefined ? { top_k: topK } : undefined,
        );

        const resultText = results
          .map((result) => `${result.label}: ${formatScore(result.score)}`)
          .join("\n");

        return textResult(resultText || "No classifications returned.", {
          audio,
          results,
        });
      } catch (error) {
        return errorResult(error, { audio: params.audio });
      }
    },
  });

  pi.registerTool({
    name: "ml-zero-shot-audio-classification",
    label: "ML Zero-Shot Audio Classification",
    description: `Classify audio using custom labels without training.

Use this to:
- Apply your own labels to audio
- Use CLAP-style zero-shot classification

Returns labels with confidence scores.

Model: Xenova/clap-htsat-unfused (CLAP, default)`,
    parameters: ZeroShotAudioClassificationParams,

    async execute(
      _toolCallId: string,
      params: ZeroShotAudioClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { audio, labels, hypothesisTemplate, model } = params;
        const classifier = await getPipeline<
          (
            input: Float32Array,
            candidateLabels: string[],
            options?: { hypothesis_template?: string },
          ) => Promise<ClassificationResult[] | ClassificationResult[][]>
        >(
          "zero-shot-audio-classification",
          model || "Xenova/clap-htsat-unfused",
          onUpdate,
        );

        const audioData = await loadAudio(audio);
        const results = await classifier(
          audioData,
          labels,
          hypothesisTemplate
            ? { hypothesis_template: hypothesisTemplate }
            : undefined,
        );
        const output = normalizeNestedArray<ClassificationResult>(results);

        const resultText = output
          .map((result) => `${result.label}: ${formatScore(result.score)}`)
          .join("\n");

        return textResult(resultText || "No classifications returned.", {
          audio,
          labels,
          results: output,
        });
      } catch (error) {
        return errorResult(error, {
          audio: params.audio,
          labels: params.labels,
        });
      }
    },
  });

  pi.registerTool({
    name: "ml-automatic-speech-recognition",
    label: "ML Automatic Speech Recognition",
    description: `Transcribe audio into text.

Use this to:
- Convert speech to text
- Extract transcripts with optional timestamps

Returns the transcription text.

Alternative models:
- Xenova/whisper-tiny.en (fastest, English)
- Xenova/whisper-base.en (fast, English)
- Xenova/whisper-small.en (balanced, English)
- Xenova/whisper-medium.en (accurate, English)
- Xenova/whisper-base (multilingual)
- Xenova/whisper-small (multilingual)
- Xenova/whisper-large-v3 (best accuracy)
- onnx-community/whisper-large-v3-turbo (fast, high quality)
- distil-whisper/distil-small.en (distilled, fast)
- distil-whisper/distil-large-v2 (distilled, accurate)`,
    parameters: AutomaticSpeechRecognitionParams,

    async execute(
      _toolCallId: string,
      params: AutomaticSpeechRecognitionParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { audio, model, returnTimestamps, language, task } = params;
        const transcriber = await getPipeline<
          (
            input: Float32Array,
            options?: {
              return_timestamps?: boolean | "word";
              language?: string;
              task?: string;
            },
          ) => Promise<AutomaticSpeechRecognitionResult>
        >(
          "automatic-speech-recognition",
          model || "onnx-community/whisper-large-v3-turbo",
          onUpdate,
        );

        const audioData = await loadAudio(audio);
        const result = await transcriber(audioData, {
          return_timestamps: returnTimestamps,
          language,
          task,
        });

        return textResult(result.text || "No transcription returned.", {
          audio,
          chunks: result.chunks,
        });
      } catch (error) {
        return errorResult(error, { audio: params.audio });
      }
    },
  });

  pi.registerTool({
    name: "ml-text-to-speech",
    label: "ML Text-to-Speech",
    description: `Generate audio from text.

Use this to:
- Synthesize speech
- Generate audio waveforms from text

Returns a base64-encoded WAV audio payload in details.

Alternative models:
- Xenova/mms-tts-eng (English, default)
- Xenova/mms-tts-spa (Spanish)
- Xenova/mms-tts-fra (French)
- Xenova/mms-tts-deu (German)
- Xenova/mms-tts-por (Portuguese)`,
    parameters: TextToSpeechParams,

    async execute(
      _toolCallId: string,
      params: TextToSpeechParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, model, speakerEmbeddings, speed } = params;
        const synthesizer = await getPipeline<
          (
            input: string,
            options?: { speaker_embeddings?: string; speed?: number },
          ) => Promise<RawAudioLike>
        >("text-to-speech", model || "Xenova/mms-tts-eng", onUpdate);

        const result = await synthesizer(text, {
          speaker_embeddings: speakerEmbeddings,
          speed,
        });

        const audioBase64 = await rawAudioToBase64(result);

        return textResult("Audio generated.", {
          text,
          mimeType: "audio/wav",
          samplingRate: result.sampling_rate,
          audioBase64,
        });
      } catch (error) {
        return errorResult(error, { text: params.text });
      }
    },
  });
}

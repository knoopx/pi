import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
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
  });

  pipelineCache.set(cacheKey, pipe);
  return pipe as T;
}

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
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
    fromURL: (url: string) => Promise<unknown>;
    read: (path: string) => Promise<unknown>;
  };

  // RawImage.read() works for both URLs and local file paths
  return rawImage.read(source);
}

// Parameter schemas
const TextClassificationParams = Type.Object({
  text: Type.String({ description: "Text to classify" }),
  model: Type.Optional(
    Type.String({
      description:
        "Model ID (default: Xenova/distilbert-base-uncased-finetuned-sst-2-english)",
    }),
  ),
});

const SummarizationParams = Type.Object({
  text: Type.String({ description: "Text to summarize" }),
  maxLength: Type.Optional(
    Type.Number({ description: "Maximum length of summary (default: 128)" }),
  ),
  minLength: Type.Optional(
    Type.Number({ description: "Minimum length of summary (default: 30)" }),
  ),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/bart-large-cnn)",
    }),
  ),
});

const TranslationParams = Type.Object({
  text: Type.String({ description: "Text to translate" }),
  sourceLang: Type.Optional(
    Type.String({ description: "Source language code (default: en)" }),
  ),
  targetLang: Type.String({
    description: "Target language code (e.g., fr, de, es)",
  }),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/nllb-200-distilled-600M)",
    }),
  ),
});

const QuestionAnsweringParams = Type.Object({
  question: Type.String({ description: "Question to answer" }),
  context: Type.String({ description: "Context containing the answer" }),
  model: Type.Optional(
    Type.String({
      description:
        "Model ID (default: Xenova/distilbert-base-uncased-distilled-squad)",
    }),
  ),
});

const TextGenerationParams = Type.Object({
  prompt: Type.String({ description: "Text prompt to continue" }),
  maxNewTokens: Type.Optional(
    Type.Number({
      description: "Maximum new tokens to generate (default: 50)",
    }),
  ),
  temperature: Type.Optional(
    Type.Number({ description: "Sampling temperature (default: 1.0)" }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model ID (default: Xenova/gpt2)" }),
  ),
});

const TokenClassificationParams = Type.Object({
  text: Type.String({ description: "Text for named entity recognition" }),
  model: Type.Optional(
    Type.String({
      description:
        "Model ID (default: Xenova/bert-base-multilingual-cased-ner-hrl)",
    }),
  ),
});

const ZeroShotClassificationParams = Type.Object({
  text: Type.String({ description: "Text to classify" }),
  labels: Type.Array(Type.String(), {
    description: "Candidate labels for classification",
  }),
  multiLabel: Type.Optional(
    Type.Boolean({
      description: "Allow multiple labels (default: false)",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/mobilebert-uncased-mnli)",
    }),
  ),
});

const FillMaskParams = Type.Object({
  text: Type.String({
    description:
      "Text with [MASK] token to fill (e.g., 'Paris is the [MASK] of France')",
  }),
  model: Type.Optional(
    Type.String({
      description: "Model ID (default: Xenova/bert-base-uncased)",
    }),
  ),
});

const ObjectDetectionParams = Type.Object({
  image: Type.String({
    description: "Image URL or local file path to analyze",
  }),
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

// Type definitions
type TextClassificationParamsType = Static<typeof TextClassificationParams>;
type SummarizationParamsType = Static<typeof SummarizationParams>;
type TranslationParamsType = Static<typeof TranslationParams>;
type QuestionAnsweringParamsType = Static<typeof QuestionAnsweringParams>;
type TextGenerationParamsType = Static<typeof TextGenerationParams>;
type TokenClassificationParamsType = Static<typeof TokenClassificationParams>;
type ZeroShotClassificationParamsType = Static<
  typeof ZeroShotClassificationParams
>;
type FillMaskParamsType = Static<typeof FillMaskParams>;

type ObjectDetectionParamsType = Static<typeof ObjectDetectionParams>;

// Pipeline result types
interface ClassificationResult {
  label: string;
  score: number;
}

interface QuestionAnsweringResult {
  answer: string;
  score: number;
  start: number;
  end: number;
}

interface GenerationResult {
  generated_text: string;
}

interface TokenClassificationResult {
  word: string;
  entity: string;
  score: number;
  start: number;
  end: number;
}

interface ZeroShotResult {
  labels: string[];
  scores: number[];
  sequence: string;
}

interface FillMaskResult {
  token_str: string;
  score: number;
  sequence: string;
}

interface SummarizationResult {
  summary_text: string;
}

interface TranslationResult {
  translation_text: string;
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

export default function transformersJsExtension(pi: ExtensionAPI) {
  // Text Classification / Sentiment Analysis
  pi.registerTool({
    name: "ml-text-classification",
    label: "ML Text Classification",
    description: `Classify text using a transformer model (sentiment analysis, etc.).

Use this to:
- Analyze sentiment (positive/negative)
- Classify text into categories
- Detect emotions or intent

Returns label and confidence score.`,
    parameters: TextClassificationParams,

    async execute(
      _toolCallId: string,
      params: TextClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, model } = params;
        const classifier = await getPipeline<
          (text: string) => Promise<ClassificationResult[]>
        >(
          "sentiment-analysis",
          model || "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
          onUpdate,
        );

        const results = await classifier(text);
        const result = results[0];

        return textResult(
          `${result.label} (confidence: ${(result.score * 100).toFixed(1)}%)`,
          { text, result },
        );
      } catch (error) {
        return errorResult(error, { text: params.text });
      }
    },
  });

  // Summarization
  pi.registerTool({
    name: "ml-summarize",
    label: "ML Summarization",
    description: `Summarize long text using a transformer model.

Use this to:
- Create concise summaries of articles
- Condense long documents
- Extract key points from text

Returns summarized text.`,
    parameters: SummarizationParams,

    async execute(
      _toolCallId: string,
      params: SummarizationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, maxLength = 128, minLength = 30, model } = params;
        const summarizer = await getPipeline<
          (
            text: string,
            options: { max_length: number; min_length: number },
          ) => Promise<SummarizationResult[]>
        >("summarization", model || "Xenova/bart-large-cnn", onUpdate);

        const results = await summarizer(text, {
          max_length: maxLength,
          min_length: minLength,
        });

        return textResult(results[0].summary_text, {
          originalLength: text.length,
          summaryLength: results[0].summary_text.length,
        });
      } catch (error) {
        return errorResult(error, { textLength: params.text.length });
      }
    },
  });

  // Translation
  pi.registerTool({
    name: "ml-translate",
    label: "ML Translation",
    description: `Translate text between languages using a transformer model.

Use this to:
- Translate text to another language
- Support for 200+ languages with NLLB model
- High-quality neural machine translation

Common language codes: en, fr, de, es, it, pt, zh, ja, ko, ar, ru`,
    parameters: TranslationParams,

    async execute(
      _toolCallId: string,
      params: TranslationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, sourceLang = "eng_Latn", targetLang, model } = params;

        // Map common language codes to NLLB format
        const langMap: Record<string, string> = {
          en: "eng_Latn",
          fr: "fra_Latn",
          de: "deu_Latn",
          es: "spa_Latn",
          it: "ita_Latn",
          pt: "por_Latn",
          zh: "zho_Hans",
          ja: "jpn_Jpan",
          ko: "kor_Hang",
          ar: "arb_Arab",
          ru: "rus_Cyrl",
          nl: "nld_Latn",
          pl: "pol_Latn",
          tr: "tur_Latn",
          vi: "vie_Latn",
          th: "tha_Thai",
          hi: "hin_Deva",
          uk: "ukr_Cyrl",
          cs: "ces_Latn",
          sv: "swe_Latn",
          da: "dan_Latn",
          fi: "fin_Latn",
          no: "nob_Latn",
          el: "ell_Grek",
          he: "heb_Hebr",
          id: "ind_Latn",
          ms: "zsm_Latn",
          ro: "ron_Latn",
          hu: "hun_Latn",
          bg: "bul_Cyrl",
          ca: "cat_Latn",
        };

        const srcLang = langMap[sourceLang] || sourceLang;
        const tgtLang = langMap[targetLang] || targetLang;

        const translator = await getPipeline<
          (
            text: string,
            options: { src_lang: string; tgt_lang: string },
          ) => Promise<TranslationResult[]>
        >("translation", model || "Xenova/nllb-200-distilled-600M", onUpdate);

        const results = await translator(text, {
          src_lang: srcLang,
          tgt_lang: tgtLang,
        });

        return textResult(results[0].translation_text, {
          sourceLang: srcLang,
          targetLang: tgtLang,
          original: text,
        });
      } catch (error) {
        return errorResult(error, {
          text: params.text,
          targetLang: params.targetLang,
        });
      }
    },
  });

  // Question Answering
  pi.registerTool({
    name: "ml-question-answering",
    label: "ML Question Answering",
    description: `Answer questions based on provided context using a transformer model.

Use this to:
- Extract answers from documents
- Find specific information in text
- Answer factual questions from context

Requires both question and context containing the answer.`,
    parameters: QuestionAnsweringParams,

    async execute(
      _toolCallId: string,
      params: QuestionAnsweringParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { question, context, model } = params;
        const qa = await getPipeline<
          (input: {
            question: string;
            context: string;
          }) => Promise<QuestionAnsweringResult>
        >(
          "question-answering",
          model || "Xenova/distilbert-base-uncased-distilled-squad",
          onUpdate,
        );

        const result = await qa({ question, context });

        return textResult(
          `${result.answer} (confidence: ${(result.score * 100).toFixed(1)}%)`,
          { question, answer: result.answer, score: result.score },
        );
      } catch (error) {
        return errorResult(error, { question: params.question });
      }
    },
  });

  // Text Generation
  pi.registerTool({
    name: "ml-text-generation",
    label: "ML Text Generation",
    description: `Generate text continuation using a transformer model.

Use this to:
- Complete text prompts
- Generate creative writing
- Produce text in a specific style

Returns generated text based on the prompt.`,
    parameters: TextGenerationParams,

    async execute(
      _toolCallId: string,
      params: TextGenerationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { prompt, maxNewTokens = 50, temperature = 1.0, model } = params;
        const generator = await getPipeline<
          (
            text: string,
            options: { max_new_tokens: number; temperature: number },
          ) => Promise<GenerationResult[]>
        >("text-generation", model || "Xenova/gpt2", onUpdate);

        const results = await generator(prompt, {
          max_new_tokens: maxNewTokens,
          temperature,
        });

        return textResult(results[0].generated_text, {
          prompt,
          maxNewTokens,
          temperature,
        });
      } catch (error) {
        return errorResult(error, { prompt: params.prompt });
      }
    },
  });

  // Named Entity Recognition (Token Classification)
  pi.registerTool({
    name: "ml-ner",
    label: "ML Named Entity Recognition",
    description: `Extract named entities from text using a transformer model.

Use this to:
- Identify people, organizations, locations
- Extract dates, money amounts, percentages
- Find named entities in documents

Returns entities with their types and positions.`,
    parameters: TokenClassificationParams,

    async execute(
      _toolCallId: string,
      params: TokenClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, model } = params;
        const ner = await getPipeline<
          (text: string) => Promise<TokenClassificationResult[]>
        >(
          "token-classification",
          model || "Xenova/bert-base-multilingual-cased-ner-hrl",
          onUpdate,
        );

        const results = await ner(text);

        // Group consecutive tokens of same entity
        const entities: { text: string; type: string; score: number }[] = [];
        let currentEntity: {
          text: string;
          type: string;
          scores: number[];
        } | null = null;

        for (const token of results) {
          const entityType = token.entity.replace(/^[BI]-/, "");
          const isBeginning = token.entity.startsWith("B-");

          if (
            isBeginning ||
            !currentEntity ||
            currentEntity.type !== entityType
          ) {
            if (currentEntity) {
              entities.push({
                text: currentEntity.text,
                type: currentEntity.type,
                score:
                  currentEntity.scores.reduce((a, b) => a + b, 0) /
                  currentEntity.scores.length,
              });
            }
            currentEntity = {
              text: token.word.replace(/^##/, ""),
              type: entityType,
              scores: [token.score],
            };
          } else {
            currentEntity.text += token.word.startsWith("##")
              ? token.word.slice(2)
              : ` ${token.word}`;
            currentEntity.scores.push(token.score);
          }
        }

        if (currentEntity) {
          entities.push({
            text: currentEntity.text,
            type: currentEntity.type,
            score:
              currentEntity.scores.reduce((a, b) => a + b, 0) /
              currentEntity.scores.length,
          });
        }

        const resultText = entities
          .map((e) => `[${e.type}] ${e.text} (${(e.score * 100).toFixed(1)}%)`)
          .join("\n");

        return textResult(resultText || "No entities found.", {
          text,
          entities,
        });
      } catch (error) {
        return errorResult(error, { text: params.text });
      }
    },
  });

  // Zero-Shot Classification
  pi.registerTool({
    name: "ml-zero-shot-classification",
    label: "ML Zero-Shot Classification",
    description: `Classify text into custom categories without training.

Use this to:
- Classify text into any categories you define
- No need for pre-trained categories
- Flexible multi-label classification

Provide text and candidate labels.`,
    parameters: ZeroShotClassificationParams,

    async execute(
      _toolCallId: string,
      params: ZeroShotClassificationParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, labels, multiLabel = false, model } = params;
        const classifier = await getPipeline<
          (
            text: string,
            labels: string[],
            options: { multi_label: boolean },
          ) => Promise<ZeroShotResult>
        >(
          "zero-shot-classification",
          model || "Xenova/mobilebert-uncased-mnli",
          onUpdate,
        );

        const result = await classifier(text, labels, {
          multi_label: multiLabel,
        });

        const resultText = result.labels
          .map(
            (label, i) => `${label}: ${(result.scores[i] * 100).toFixed(1)}%`,
          )
          .join("\n");

        return textResult(resultText, { text, labels, result });
      } catch (error) {
        return errorResult(error, { text: params.text, labels: params.labels });
      }
    },
  });

  // Fill Mask
  pi.registerTool({
    name: "ml-fill-mask",
    label: "ML Fill Mask",
    description: `Predict masked words in text using a transformer model.

Use this to:
- Complete sentences with missing words
- Test language model predictions
- Fill in blanks contextually

Use [MASK] token to indicate the word to predict.`,
    parameters: FillMaskParams,

    async execute(
      _toolCallId: string,
      params: FillMaskParamsType,
      _signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const { text, model } = params;
        const fillMask = await getPipeline<
          (text: string) => Promise<FillMaskResult[]>
        >("fill-mask", model || "Xenova/bert-base-uncased", onUpdate);

        const results = await fillMask(text);

        const resultText = results
          .slice(0, 5)
          .map(
            (r) =>
              `"${r.token_str}" (${(r.score * 100).toFixed(1)}%): ${r.sequence}`,
          )
          .join("\n");

        return textResult(resultText, {
          text,
          predictions: results.slice(0, 5),
        });
      } catch (error) {
        return errorResult(error, { text: params.text });
      }
    },
  });

  // Object Detection
  pi.registerTool({
    name: "ml-object-detection",
    label: "ML Object Detection",
    description: `Detect objects in images using a transformer model.

Use this to:
- Find objects and bounding boxes in images
- Run YOLOS and other object detection models
- Analyze local images or URLs

Returns detected objects with confidence scores and bounding boxes.`,
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
              `${result.label} ${(result.score * 100).toFixed(1)}% ` +
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
}

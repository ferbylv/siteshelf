import { getLanguageModel } from './prompt-api';
import { loadAiSettings } from './settings';
import {
  CATEGORIES,
  UNCATEGORIZED,
  type AiClassification,
  type Category,
  type PageMetadata,
} from './types';

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'category', 'tags'],
  additionalProperties: false,
};

function buildPrompt(meta: PageMetadata): string {
  return [
    '你是网页分类助手。只根据下列公开元数据，判断这个网页或站点是做什么的。',
    '不要臆造登录信息、密码或任何未提供的隐私内容。',
    '输出 JSON，字段：',
    '- summary: 一句简体中文，说明这个页面或站点的用途',
    `- category: 必须是以下之一：${CATEGORIES.join('、')}`,
    '- tags: 2 到 4 个简短中文或英文标签',
    '',
    `URL: ${meta.url}`,
    `标题: ${meta.title}`,
    `描述: ${meta.description}`,
    `摘录: ${meta.excerpt}`,
  ].join('\n');
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型未返回 JSON');
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function sanitize(raw: Record<string, unknown>): AiClassification {
  const summary =
    typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim().replace(/\s+/g, ' ').slice(0, 120)
      : '（尚未生成摘要）';

  const categoryRaw = typeof raw.category === 'string' ? raw.category.trim() : '';
  const category: Category = (CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as Category)
    : '其他';

  const tagsSrc = Array.isArray(raw.tags) ? raw.tags : [];
  const tags = tagsSrc
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => t.slice(0, 16));

  return { summary, category, tags };
}

export const FAILED_CLASSIFICATION: AiClassification = {
  summary: '',
  category: UNCATEGORIZED,
  tags: [],
};

async function classifyWithPromptApi(meta: PageMetadata): Promise<AiClassification> {
  const LM = getLanguageModel();
  if (!LM) throw new Error('当前浏览器没有 Prompt API');

  const availability = await LM.availability();
  if (availability === 'unavailable') {
    throw new Error('本地语言模型不可用');
  }

  const session = await LM.create({
    initialPrompts: [
      {
        role: 'system',
        content: '你只输出 JSON，不要 Markdown 或解释。',
      },
    ],
  });

  try {
    const text = await session.prompt(buildPrompt(meta), {
      responseConstraint: CLASSIFY_SCHEMA,
    });
    return sanitize(parseJsonObject(text));
  } finally {
    session.destroy();
  }
}

function completionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

async function classifyWithOpenAI(meta: PageMetadata): Promise<AiClassification> {
  const settings = await loadAiSettings();
  if (!settings.apiKey.trim()) {
    throw new Error('尚未配置兼容 API 密钥');
  }
  if (!settings.baseUrl.trim() || !settings.model.trim()) {
    throw new Error('尚未配置 API 地址或模型名');
  }

  const response = await fetch(completionsUrl(settings.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你只输出 JSON，不要 Markdown 或解释。',
        },
        { role: 'user', content: buildPrompt(meta) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`兼容 API 请求失败（${response.status}）`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('兼容 API 返回为空');
  return sanitize(parseJsonObject(content));
}

export async function classifyPage(
  meta: PageMetadata,
): Promise<{ result: AiClassification; source: 'prompt-api' | 'openai' | 'none'; error?: string }> {
  const settings = await loadAiSettings();
  const errors: string[] = [];

  const tryPrompt =
    settings.provider === 'auto' || settings.provider === 'prompt-api';
  const tryOpenAI =
    settings.provider === 'auto' || settings.provider === 'openai-compatible';

  if (tryPrompt) {
    try {
      const result = await classifyWithPromptApi(meta);
      return { result, source: 'prompt-api' };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Prompt API 失败');
      if (settings.provider === 'prompt-api') {
        return {
          result: FAILED_CLASSIFICATION,
          source: 'none',
          error: errors[0],
        };
      }
    }
  }

  if (tryOpenAI) {
    try {
      const result = await classifyWithOpenAI(meta);
      return { result, source: 'openai' };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : '兼容 API 失败');
    }
  }

  return {
    result: FAILED_CLASSIFICATION,
    source: 'none',
    error: errors[0] || 'AI 暂不可用',
  };
}

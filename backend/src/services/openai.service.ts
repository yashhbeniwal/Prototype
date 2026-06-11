import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from './prisma.service';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────
// Speech-to-Text (Whisper)
// ─────────────────────────────────────────────────────

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const tmpPath = path.join('/tmp', filename);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      language: 'en',
    });
    return transcription.text;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

// ─────────────────────────────────────────────────────
// Text-to-Speech
// ─────────────────────────────────────────────────────

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
  });
  const buffer = Buffer.from(await mp3.arrayBuffer());
  return buffer;
}

// ─────────────────────────────────────────────────────
// AI Query Engine - translates natural language to DB data
// ─────────────────────────────────────────────────────

interface VoiceQueryResult {
  query: string;
  answer: string;
  data?: any;
}

export async function processVoiceQuery(
  transcription: string,
  farmId: string,
  userId: string
): Promise<VoiceQueryResult> {
  // Build a context-aware system prompt with farm metadata
  const [animalCount, pendingVaccinations, unpaidInvoices] = await Promise.all([
    prisma.animal.count({ where: { farmId, status: 'ACTIVE' } }),
    prisma.vaccination.count({
      where: {
        animal: { farmId },
        status: { in: ['PENDING', 'OVERDUE'] },
        nextDueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.invoice.aggregate({
      where: { farmId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
      _sum: { balanceAmount: true },
    }),
  ]);

  const systemPrompt = `You are an intelligent farm management assistant for a goat farm.
Current farm context:
- Farm ID: ${farmId}
- Total active animals: ${animalCount}
- Vaccinations due this week: ${pendingVaccinations}
- Total outstanding payments: ₹${(unpaidInvoices._sum.balanceAmount || 0).toFixed(2)}
- Current date: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}

You have access to farm data. When the user asks a question, provide a clear, concise, helpful answer.
Answer in 1-3 sentences. Be specific with numbers. Always use Indian Rupee (₹) for money.
If asked about specific animals, mention their ID. Respond in English.`;

  // Classify the intent and fetch relevant data
  const intentResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Query: "${transcription}"

Based on this query, what specific database information do I need? Reply with a JSON object:
{
  "intent": "animal_count|vaccination_due|outstanding_payment|animal_history|customer_balance|feed_stock|general",
  "filters": {},
  "answer_directly": "If you can answer from the context above without additional DB queries, provide the answer here. Otherwise null."
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const intent = JSON.parse(intentResponse.choices[0].message.content || '{}');

  let contextData: any = {};
  let answer = intent.answer_directly;

  if (!answer) {
    // Fetch additional data based on intent
    contextData = await fetchDataForIntent(intent.intent, farmId, transcription);

    // Generate natural language answer
    const answerResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Original query: "${transcription}"` },
        {
          role: 'assistant',
          content: `Retrieved data: ${JSON.stringify(contextData, null, 2)}`,
        },
        {
          role: 'user',
          content:
            'Now please provide a clear, helpful, conversational answer to the original query based on the retrieved data. Keep it concise (1-3 sentences).',
        },
      ],
      temperature: 0.3,
    });

    answer = answerResponse.choices[0].message.content || 'I could not find relevant information.';
  }

  logger.info(`Voice query processed: "${transcription}" → "${answer.substring(0, 100)}..."`);

  return { query: transcription, answer, data: contextData };
}

async function fetchDataForIntent(intent: string, farmId: string, query: string): Promise<any> {
  const now = new Date();
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  switch (intent) {
    case 'animal_count': {
      const counts = await prisma.animal.groupBy({
        by: ['status', 'breed', 'gender'],
        where: { farmId },
        _count: true,
      });
      return { animalBreakdown: counts };
    }

    case 'vaccination_due': {
      const due = await prisma.vaccination.findMany({
        where: {
          animal: { farmId },
          nextDueDate: { lte: weekFromNow },
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        include: { animal: { select: { customId: true, name: true, breed: true } } },
        orderBy: { nextDueDate: 'asc' },
        take: 20,
      });
      return { dueSoon: due };
    }

    case 'outstanding_payment': {
      const customers = await prisma.customer.findMany({
        where: { outstandingBalance: { gt: 0 } },
        orderBy: { outstandingBalance: 'desc' },
        take: 10,
        select: { name: true, mobile: true, outstandingBalance: true },
      });
      const total = customers.reduce((s, c) => s + c.outstandingBalance, 0);
      return { topDebtors: customers, totalOutstanding: total };
    }

    case 'animal_history': {
      // Extract animal ID pattern from query
      const match = query.match(/[A-Z]+\d{3,}/i);
      if (match) {
        const animal = await prisma.animal.findFirst({
          where: { farmId, customId: { contains: match[0], mode: 'insensitive' } },
          include: {
            medicalHistory: { orderBy: { date: 'desc' }, take: 5 },
            vaccinations: { orderBy: { dateGiven: 'desc' }, take: 5 },
          },
        });
        return { animal };
      }
      return { error: 'Animal ID not found in query' };
    }

    case 'customer_balance': {
      const top = await prisma.customer.findFirst({
        orderBy: { outstandingBalance: 'desc' },
        select: { name: true, mobile: true, outstandingBalance: true },
      });
      return { topCustomer: top };
    }

    case 'feed_stock': {
      const inventory = await prisma.feedInventory.findMany({
        where: { farmId },
        select: {
          feedType: true,
          availableStock: true,
          minimumThreshold: true,
          costPerKg: true,
        },
      });
      const lowStock = inventory.filter((i) => i.availableStock <= i.minimumThreshold);
      return { inventory, lowStockAlert: lowStock };
    }

    default:
      return {};
  }
}

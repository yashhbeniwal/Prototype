import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { transcribeAudio, processVoiceQuery, synthesizeSpeech } from '../services/openai.service';
import { uploadToS3 } from '../services/s3.service';
import { createError } from '../middlewares/error.middleware';
import { logger } from '../utils/logger';

// ─── Voice Query Endpoint ─────────────────────────────────────────────────────

/**
 * POST /api/v1/voice/query
 * Accepts: multipart/form-data with audio file (WebM/WAV/MP3)
 * OR JSON body with { text: string } for text-based queries
 */
export async function handleVoiceQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();

  try {
    const farmId = req.user!.farmId;
    if (!farmId) throw createError('Farm not assigned to user', 400);

    let transcript: string;

    // If audio file is uploaded, transcribe it
    if (req.file) {
      logger.info(`Processing voice query for user ${req.user!.id} - file: ${req.file.originalname}`);
      transcript = await transcribeAudio(req.file.buffer, req.file.originalname);
    } else if (req.body.text) {
      // Text-based fallback (for testing or keyboard input)
      transcript = req.body.text;
    } else {
      throw createError('Provide either an audio file or text query', 400);
    }

    logger.info(`Voice transcript: "${transcript}"`);

    // Process query against the database
    const result = await processVoiceQuery(transcript, farmId, req.user!.id);

    // Generate voice response
    let audioUrl: string | null = null;
    try {
      const audioBuffer = await synthesizeSpeech(result.answer);
      const s3Result = await uploadToS3(audioBuffer, 'voice-response.mp3', 'audio/mpeg', 'voice-responses');
      audioUrl = s3Result.url;
    } catch (ttsErr) {
      logger.warn('TTS generation failed, returning text only:', ttsErr);
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Voice query completed in ${elapsed}ms`);

    res.json({
      success: true,
      data: {
        transcript: result.query,
        answer: result.answer,
        audioUrl,
        processingTimeMs: elapsed,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/voice/transcribe
 * Only transcribes audio to text, no query processing
 */
export async function transcribeOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw createError('Audio file required', 400);
    const transcript = await transcribeAudio(req.file.buffer, req.file.originalname);
    res.json({ success: true, data: { transcript } });
  } catch (err) {
    next(err);
  }
}

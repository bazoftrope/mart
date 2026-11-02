import 'reflect-metadata';
import { Stream, MarathonTemplate } from '@db/models';
import type { StreamStatus } from '@db/models/Stream';
import { syncStreamStatus } from './streamCompleter';

export async function ensureStreamStatusFor(
  stream: Stream,
  durationDays: number
): Promise<StreamStatus> {
  if (stream.status === 'open' || stream.status === 'running') {
    await syncStreamStatus(stream, durationDays);
  }

  return stream.status;
}

export async function ensureStreamStatus(streamId: string): Promise<StreamStatus> {
  const stream = await Stream.findByPk(streamId);
  if (!stream) {
    return 'open';
  }

  const template = await MarathonTemplate.findByPk(stream.templateId, {
    attributes: ['durationDays'],
  });

  return ensureStreamStatusFor(stream, template?.durationDays ?? 0);
}

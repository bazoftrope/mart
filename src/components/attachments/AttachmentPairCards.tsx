import AudioPlayer from 'react-h5-audio-player';
import type { AttachmentData } from '@/types/attachments';
import { groupMediaAttachments } from '@/lib/attachmentGroups';
import KinescopePlayer from '@/components/day/KinescopePlayer';
import styles from './AttachmentPairCards.module.css';

type AttachmentPairCardsProps = {
  attachments: AttachmentData[];
};

export default function AttachmentPairCards({ attachments }: AttachmentPairCardsProps) {
  const pairs = groupMediaAttachments(attachments);

  if (pairs.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      {pairs.map((pair) => {
        const media: AttachmentData | undefined = pair.audio || pair.video;
        const isVideo = Boolean(pair.video);
        const description = media?.description || null;
        return (
          <div key={pair.pairId} className={styles.card}>
            {pair.audio && (
              <AudioPlayer
                className={styles.audioPlayer}
                src={pair.audio.url}
                preload="metadata"
                showDownloadProgress={false}
                showJumpControls={false}
                showFilledVolume
                autoPlayAfterSrcChange={false}
                i18nAriaLabels={{
                  player: 'Аудиоплеер',
                  progressControl: 'Управление воспроизведением',
                  volumeControl: 'Регулятор громкости',
                  play: 'Воспроизвести',
                  pause: 'Пауза',
                  loop: 'Включить зацикливание',
                  loopOff: 'Выключить зацикливание',
                  volume: 'Включить звук',
                  volumeMute: 'Выключить звук',
                }}
                footer={
                  pair.pdf || description ? (
                    <div className={styles.footer}>
                      {description && <div className={styles.description}>{description}</div>}
                      {pair.pdf && (
                        <a className={styles.pdfLink} href={pair.pdf.url} target="_blank" rel="noreferrer">
                          {pair.pdf.fileName || 'Открыть PDF'}
                        </a>
                      )}
                    </div>
                  ) : undefined
                }
              >
                Ваш браузер не поддерживает воспроизведение аудио.
              </AudioPlayer>
            )}
            {pair.video && !pair.audio && (
              <>
                <KinescopePlayer videoId={pair.video.url} title={pair.video.fileName || 'Видеоурок'} />
                {(description || pair.pdf) && (
                  <div className={styles.mediaMeta}>
                    {description && <div className={styles.description}>{description}</div>}
                    {pair.pdf && (
                      <a className={styles.pdfLink} href={pair.pdf.url} target="_blank" rel="noreferrer">
                        {pair.pdf.fileName || 'Открыть PDF'}
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
            {!media && pair.pdf && (
              <a className={styles.fileLink} href={pair.pdf.url} target="_blank" rel="noreferrer">
                {pair.pdf.fileName || 'Открыть PDF'}
              </a>
            )}
            {!media && !pair.pdf && <p className={styles.missing}>Материал отсутствует.</p>}
            {isVideo && pair.audio && (
              // На случай если вдруг оба media в одной паре (не должно быть) — покажем оба
              <KinescopePlayer videoId={pair.video!.url} title={pair.video!.fileName || 'Видеоурок'} />
            )}
          </div>
        );
      })}
    </div>
  );
}

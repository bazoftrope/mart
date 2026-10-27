import AudioPlayer from 'react-h5-audio-player';
import type { AttachmentData } from '@/types/attachments';
import { groupMediaAttachments } from '@/lib/attachmentGroups';
import KinescopePlayer from '@/components/day/KinescopePlayer';
import styles from './AttachmentPairCards.module.css';

type AttachmentPairCardsProps = {
  attachments: AttachmentData[];
};

function PdfLinks({ pdfs }: { pdfs: AttachmentData[] }) {
  if (pdfs.length === 0) return null;

  return (
    <div className={styles.pdfList}>
      {pdfs.map((pdf, index) => (
        <a
          key={pdf.id || `${pdf.url}-${index}`}
          className={styles.pdfLink}
          href={pdf.url}
          target="_blank"
          rel="noreferrer"
        >
          {pdf.fileName || 'Открыть PDF'}
        </a>
      ))}
    </div>
  );
}

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
        const hasPdfs = pair.pdfs.length > 0;
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
                  hasPdfs || description ? (
                    <div className={styles.footer}>
                      {description && <div className={styles.description}>{description}</div>}
                      <PdfLinks pdfs={pair.pdfs} />
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
                {(description || hasPdfs) && (
                  <div className={styles.mediaMeta}>
                    {description && <div className={styles.description}>{description}</div>}
                    <PdfLinks pdfs={pair.pdfs} />
                  </div>
                )}
              </>
            )}
            {!media && hasPdfs && <PdfLinks pdfs={pair.pdfs} />}
            {!media && !hasPdfs && <p className={styles.missing}>Материал отсутствует.</p>}
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

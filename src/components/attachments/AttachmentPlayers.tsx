import AudioPlayer from 'react-h5-audio-player';
import type { AttachmentData } from '@/types/attachments';
import KinescopePlayer from '@/components/day/KinescopePlayer';
import AttachmentPairCards from '@/components/attachments/AttachmentPairCards';
import styles from './AttachmentPlayers.module.css';

type AttachmentPlayersProps = {
  attachments: AttachmentData[];
  emptyText?: string;
};

export default function AttachmentPlayers({
  attachments,
  emptyText = 'Материалы пока не добавлены.',
}: AttachmentPlayersProps) {
  if (!attachments || attachments.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  const pairedAttachments = attachments.filter((attachment) => attachment.pairId);
  const standaloneAttachments = attachments.filter((attachment) => !attachment.pairId);
  const audios = standaloneAttachments.filter((attachment) => attachment.kind === 'audio');
  const videos = standaloneAttachments.filter((attachment) => attachment.kind === 'video');
  const files = standaloneAttachments.filter((attachment) => attachment.kind === 'file');
  const images = standaloneAttachments.filter((attachment) => attachment.kind === 'image');

  return (
    <div className={styles.wrapper}>
      {files.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupList}>
            {files.map((attachment) => (
              <a
                key={attachment.id || attachment.url}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className={styles.fileLink}
              >
                {attachment.fileName || 'Открыть PDF'}
              </a>
            ))}
          </div>
        </div>
      )}
      {pairedAttachments.length > 0 && (
        <AttachmentPairCards attachments={pairedAttachments} />
      )}

      {audios.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupList}>
            {audios.map((attachment) => (
              <div key={attachment.id || attachment.url} className={styles.mediaCard}>
                <div className={styles.audioBlock}>
                  <AudioPlayer
                    className={styles.audioPlayer}
                    src={attachment.url}
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
                  >
                    Ваш браузер не поддерживает воспроизведение аудио.
                  </AudioPlayer>
                </div>
                {attachment.description && (
                  <div className={styles.mediaDescription}>{attachment.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupList}>
            {videos.map((attachment) => (
              <div key={attachment.id || attachment.url} className={styles.mediaCard}>
                <KinescopePlayer
                  videoId={attachment.url}
                  title={attachment.fileName || 'Видеоурок'}
                />
                {attachment.description && (
                  <div className={styles.mediaDescription}>{attachment.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupList}>
            <div className={styles.imageGrid}>
              {images.map((attachment) => (
                <a
                  key={attachment.id || attachment.url}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.imageCard}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.url}
                    alt={attachment.fileName || 'Изображение'}
                    className={styles.image}
                    loading="lazy"
                  />
                  {attachment.fileName && (
                    <span className={styles.imageName}>{attachment.fileName}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { FileText } from 'lucide-react';
import type { AttachmentData } from '@/types/attachments';
import styles from './PdfLinks.module.css';

type PdfLinksProps = {
  pdfs: AttachmentData[];
  className?: string;
};

export default function PdfLinks({ pdfs, className }: PdfLinksProps) {
  if (pdfs.length === 0) return null;

  return (
    <div className={`${styles.list} ${className ?? ''}`.trim()}>
      {pdfs.map((pdf, index) => (
        <a
          key={pdf.id || `${pdf.url}-${index}`}
          className={styles.badge}
          href={pdf.url}
          target="_blank"
          rel="noreferrer"
          title={pdf.fileName || 'Открыть PDF'}
          aria-label={
            pdf.fileName ? `Открыть PDF: ${pdf.fileName}` : 'Открыть PDF'
          }
        >
          <FileText size={15} aria-hidden="true" />
          <span>PDF</span>
        </a>
      ))}
    </div>
  );
}

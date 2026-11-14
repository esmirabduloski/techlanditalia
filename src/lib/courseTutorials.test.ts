import { describe, expect, it } from 'vitest';
import {
  hasTutorialContent,
  isMissingTutorialsSchema,
  tutorialFilePath,
  validateTutorialFile,
  validateVideoLink,
  videoEmbedUrl,
  TUTORIAL_MAX_BYTES,
} from './courseTutorials';

describe('videoEmbedUrl', () => {
  it('trasforma i link YouTube in embed senza cookie', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(videoEmbedUrl(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    }
  });

  it('trasforma i link Vimeo nel player', () => {
    expect(videoEmbedUrl('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789');
    expect(videoEmbedUrl('https://player.vimeo.com/video/123456789')).toBe('https://player.vimeo.com/video/123456789');
  });

  it('rifiuta altri siti, http e link rotti', () => {
    for (const url of [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://evil.test/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=<script>',
      'javascript:alert(1)',
      'non è un link',
    ]) {
      expect(videoEmbedUrl(url)).toBeNull();
    }
  });
});

describe('validateVideoLink', () => {
  it('accetta il vuoto e YouTube, rifiuta il resto con un messaggio', () => {
    expect(validateVideoLink('')).toBeNull();
    expect(validateVideoLink('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(validateVideoLink('https://example.com/video.mp4')).toMatch(/YouTube o Vimeo/);
  });
});

describe('validateTutorialFile', () => {
  it('accetta PDF e video mp4/webm, anche se il browser non dà il tipo', () => {
    expect(validateTutorialFile({ name: 'Guida.PDF', type: 'application/pdf', size: 1000 }, 'pdf')).toBeNull();
    expect(validateTutorialFile({ name: 'guida.pdf', type: '', size: 1000 }, 'pdf')).toBeNull();
    expect(validateTutorialFile({ name: 'video.mp4', type: 'video/mp4', size: 1000 }, 'video')).toBeNull();
    expect(validateTutorialFile({ name: 'video.webm', type: 'video/webm', size: 1000 }, 'video')).toBeNull();
  });

  it('rifiuta tipi sbagliati, file vuoti e troppo grandi', () => {
    expect(validateTutorialFile({ name: 'guida.docx', type: 'application/msword', size: 10 }, 'pdf')).toMatch(/PDF/);
    expect(validateTutorialFile({ name: 'video.mov', type: 'video/quicktime', size: 10 }, 'video')).toMatch(/mp4/);
    expect(validateTutorialFile({ name: 'guida.pdf', type: 'video/mp4', size: 10 }, 'pdf')).toMatch(/PDF/);
    expect(validateTutorialFile({ name: 'guida.pdf', type: 'application/pdf', size: 0 }, 'pdf')).toMatch(/vuoto/);
    expect(validateTutorialFile({ name: 'video.mp4', type: 'video/mp4', size: TUTORIAL_MAX_BYTES + 1 }, 'video')).toMatch(/50 MB/);
  });
});

describe('tutorialFilePath', () => {
  it('mette il file nella cartella del corso con un nome pulito', () => {
    expect(tutorialFilePath('c1', 'pdf', 'La mia guida (1).pdf', 42)).toBe('c1/guida-42.pdf');
    expect(tutorialFilePath('c1', 'video', 'Tutorial.WEBM', 42)).toBe('c1/video-42.webm');
    expect(tutorialFilePath('c1', 'video', 'tutorial.mp4', 42)).toBe('c1/video-42.mp4');
  });
});

describe('hasTutorialContent / isMissingTutorialsSchema', () => {
  it('serve almeno un video o un PDF', () => {
    const empty = { course_id: 'c1', video_url: null, video_path: null, pdf_path: null };
    expect(hasTutorialContent(null)).toBe(false);
    expect(hasTutorialContent(empty)).toBe(false);
    expect(hasTutorialContent({ ...empty, pdf_path: 'c1/guida.pdf' })).toBe(true);
    expect(hasTutorialContent({ ...empty, video_url: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(true);
  });

  it('riconosce la tabella mancante', () => {
    expect(isMissingTutorialsSchema({ code: '42P01' })).toBe(true);
    expect(isMissingTutorialsSchema({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTutorialsSchema({ code: '42501' })).toBe(false);
  });
});

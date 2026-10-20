import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  certificateFileName,
  certificateImageFileName,
  certificateUrl,
  certificateValues,
  certificatesUnlocked,
  fillCertificateSvg,
  formatHours,
  isCertificatePublic,
  linkedInAddToProfileUrl,
  nameFontSize,
  normalizeCertificateCode,
  sharingAvailable,
  type CertificateData,
} from './certificate';
import { qrPath } from './qrCode';

const cert: CertificateData = {
  student_name: ' Giulia Bianchi ',
  course_title: 'Sviluppo giochi con Roblox',
  teacher_name: 'Marco Rossi',
  hard_skills: ['Programmazione in Lua', 'Modellazione 3D'],
  soft_skills: ['Problem solving'],
  issued_on: '2026-10-16',
  code: 'TL-2026-7K3QF',
};

describe('formatHours', () => {
  it('intere senza decimali, mezze ore con la virgola', () => {
    expect(formatHours(45)).toBe('45');
    expect(formatHours(46.5)).toBe('46,5');
    expect(formatHours(0)).toBe('0');
  });
});

describe('certificateValues', () => {
  it('riempie tutti i segnaposto: 32 lezioni e 320 ore per tutti, competenze mancanti vuote', () => {
    const v = certificateValues(cert);
    expect(v).toMatchObject({
      NOME: 'Giulia Bianchi',
      LEZIONI: '32',
      TOTALE: '32',
      ORE: '320',
      DATA: '16/10/2026',
      HARD_1: 'Programmazione in Lua',
      HARD_3: '',
      SOFT_1: 'Problem solving',
      SOFT_4: '',
      CODICE: 'TL-2026-7K3QF',
    });
    expect(v.HARD_6).toBeUndefined();
  });
});

describe('nameFontSize', () => {
  it('riduce solo i nomi lunghi, con un minimo', () => {
    expect(nameFontSize('Giulia Bianchi')).toBe(44);
    expect(nameFontSize('Maria Vittoria Esposito Della Valle')).toBeLessThan(44);
    expect(nameFontSize('x'.repeat(200))).toBe(26);
  });
});

describe('fillCertificateSvg', () => {
  const template = [
    '<svg>',
    '<text id="cert-name" x="1" font-size="44" font-weight="800">{{NOME}}</text>',
    '<text id="cert-course" font-size="21">{{CORSO}}</text>',
    '<g data-slot="HARD_1"><circle/><text>{{HARD_1}}</text></g>',
    '<g data-slot="HARD_2"><circle/><text>{{HARD_2}}</text></g>',
    '<g data-slot="HARD_3"><circle/><text>{{HARD_3}}</text></g>',
    '<text>{{ORE}} ore · {{SCONOSCIUTO}}</text>',
    '</svg>',
  ].join('');

  it('sostituisce i valori e toglie le competenze vuote', () => {
    const svg = fillCertificateSvg(template, cert);
    expect(svg).toContain('>Giulia Bianchi<');
    expect(svg).toContain('>Modellazione 3D<');
    expect(svg).not.toContain('data-slot="HARD_3"');
    expect(svg).toContain('320 ore');
    // Un segnaposto sconosciuto resta visibile
    expect(svg).toContain('{{SCONOSCIUTO}}');
  });

  it('fa l\'escape dei caratteri XML', () => {
    const svg = fillCertificateSvg(template, { ...cert, student_name: 'Tom & <Jerry>' });
    expect(svg).toContain('Tom &amp; &lt;Jerry&gt;');
  });

  it('riduce il carattere di un nome lungo', () => {
    const svg = fillCertificateSvg(template, { ...cert, student_name: 'Maria Vittoria Esposito Della Valle' });
    expect(svg).toMatch(/id="cert-name" x="1" font-size="(\d+)"/);
    expect(Number(svg.match(/id="cert-name" x="1" font-size="(\d+)"/)![1])).toBeLessThan(44);
  });
});

describe('certificateFileName', () => {
  it('senza accenti né spazi', () => {
    expect(certificateFileName({ student_name: 'Niccolò D\'Amico', course_title: 'Python & AI' })).toBe(
      'Attestato-Niccolo-D-Amico-Python-AI.pdf',
    );
  });
});

describe('certificatesUnlocked', () => {
  it('dal giorno dell\'ultima lezione', () => {
    expect(certificatesUnlocked({ today: '2026-10-15', lastLessonDate: '2026-10-16', lastLessonMarked: true })).toBe(false);
    expect(certificatesUnlocked({ today: '2026-10-16', lastLessonDate: '2026-10-16', lastLessonMarked: false })).toBe(true);
  });

  it('senza data in calendario serve la presenza dell\'ultima lezione', () => {
    expect(certificatesUnlocked({ today: '2026-10-16', lastLessonDate: null, lastLessonMarked: false })).toBe(false);
    expect(certificatesUnlocked({ today: '2026-10-16', lastLessonDate: null, lastLessonMarked: true })).toBe(true);
  });
});

describe('modello vero (attestato.svg)', () => {
  const template = readFileSync(new URL('../assets/certificates/attestato.svg', import.meta.url), 'utf8');

  it('senza QR il riquadro del QR sparisce', () => {
    const svg = fillCertificateSvg(template, cert);
    expect(svg).not.toContain('data-slot="QR_PATH"');
    expect(svg).toContain('verificalo su techlanditalia.it/attestato');
  });

  it('con il QR punta alla pagina di verifica e non lascia segnaposto', () => {
    const qr = qrPath(certificateUrl(cert.code));
    const svg = fillCertificateSvg(template, cert, qr);
    expect(svg).toContain(`viewBox="0 0 ${qr.size} ${qr.size}"`);
    expect(svg).toContain(`d="${qr.d}"`);
    expect(svg).not.toMatch(/\{\{[A-Z_0-9]+\}\}/);
  });
});

describe('qrPath', () => {
  it('link di un attestato: versione 4 (33 moduli), con i quadrati di posizione', () => {
    const qr = qrPath('https://techlanditalia.it/attestato/TL-2026-7K3QF');
    expect(qr.size).toBe(33);
    // Prima riga: quadrato in alto a sinistra (7 moduli) e in alto a destra
    expect(qr.d.startsWith('M0 0h7v1h-7z')).toBe(true);
    expect(qr.d).toContain('M26 0h7v1h-7z');
    expect(qrPath('https://techlanditalia.it/attestato/TL-2026-7K3QF')).toEqual(qr);
  });
});

describe('link pubblici', () => {
  it('link di verifica, lo stesso del QR', () => {
    expect(certificateUrl('TL-2026-7K3QF')).toBe('https://techlanditalia.it/attestato/TL-2026-7K3QF');
  });

  it('codice scritto a mano o link incollato', () => {
    expect(normalizeCertificateCode(' tl-2026-7k3qf ')).toBe('TL-2026-7K3QF');
    expect(normalizeCertificateCode('TL 2026 7K3QF')).toBe('TL-2026-7K3QF');
    expect(normalizeCertificateCode('TL - 2026 - 7K3QF')).toBe('TL-2026-7K3QF');
    expect(normalizeCertificateCode('https://techlanditalia.it/attestato/TL-2026-7K3QF?utm=x')).toBe('TL-2026-7K3QF');
    expect(normalizeCertificateCode('')).toBeNull();
    expect(normalizeCertificateCode('<script>')).toBeNull();
    expect(normalizeCertificateCode('X'.repeat(60))).toBeNull();
  });

  it('LinkedIn: certificazione già compilata, con link e codice', () => {
    const url = new URL(linkedInAddToProfileUrl(cert));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/profile/add');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: 'CERTIFICATION_NAME',
      name: 'Sviluppo giochi con Roblox',
      organizationName: 'TECHLAND',
      issueYear: '2026',
      issueMonth: '10',
      certUrl: 'https://techlanditalia.it/attestato/TL-2026-7K3QF',
      certId: 'TL-2026-7K3QF',
    });
  });

  it('immagine con lo stesso nome del PDF', () => {
    expect(certificateImageFileName(cert)).toBe('Attestato-Giulia-Bianchi-Sviluppo-giochi-con-Roblox.png');
  });

  it('condivisione disponibile solo con la 0064 applicata (colonna shared_at)', () => {
    expect(sharingAvailable({ code: 'x' })).toBe(false);
    expect(sharingAvailable({ code: 'x', shared_at: null })).toBe(true);
    expect(isCertificatePublic({ shared_at: null })).toBe(false);
    expect(isCertificatePublic({ shared_at: '2026-10-20T10:00:00Z' })).toBe(true);
  });
});

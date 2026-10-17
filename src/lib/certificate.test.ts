import { describe, expect, it } from 'vitest';
import {
  certificateFileName,
  certificateValues,
  certificatesUnlocked,
  fillCertificateSvg,
  formatHours,
  nameFontSize,
  type CertificateData,
} from './certificate';

const cert: CertificateData = {
  student_name: ' Giulia Bianchi ',
  course_title: 'Sviluppo giochi con Roblox',
  teacher_name: 'Marco Rossi',
  lessons_attended: 31,
  lessons_total: 32,
  hours_attended: 46.5,
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
  it('riempie tutti i segnaposto, competenze mancanti vuote', () => {
    const v = certificateValues(cert);
    expect(v).toMatchObject({
      NOME: 'Giulia Bianchi',
      LEZIONI: '31',
      TOTALE: '32',
      ORE: '46,5',
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
    expect(svg).toContain('46,5 ore');
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

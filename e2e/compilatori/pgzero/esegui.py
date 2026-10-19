#!/usr/bin/env python3
"""
Esegue davvero i programmi Pygame Zero dei corsi, senza schermo né audio.

Il sito non esegue Pygame Zero (l'alunno copia il codice su Replit): qui ogni
programma gira con `python -m pgzero` per qualche secondo. Va bene se dopo
SECONDI il gioco è ancora vivo o se finisce da solo senza errori; è un errore
se si ferma con un traceback.

Immagini, suoni, musiche e font stanno su Replit e non nel codice: se il
programma ne chiede uno che manca, qui si crea un segnaposto e si riprova.
Così si prova il codice, non gli asset.

Programmi provati: e2e/compilatori/pgzero/casi/*.py e i task/compiti Pygame
Zero di e2e/compilatori/task-reali.json (se c'è), meno quelli elencati in
e2e/compilatori/task-reali.eccezioni.json.

    pip install -r e2e/compilatori/pgzero/requirements.txt
    npm run test:pgzero              # tutti
    npm run test:pgzero -- astronave # solo quelli col nome che contiene "astronave"
"""
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
import zlib
from importlib.util import find_spec
from pathlib import Path

QUI = Path(__file__).resolve().parent
CASI = QUI / "casi"
TASK_REALI = QUI.parent / "task-reali.json"
ECCEZIONI = QUI.parent / "task-reali.eccezioni.json"
SECONDI = 3
MAX_SEGNAPOSTO = 20

AMBIENTE = {
    **os.environ,
    "SDL_VIDEODRIVER": "dummy",
    "SDL_AUDIODRIVER": "dummy",
    "PYGAME_HIDE_SUPPORT_PROMPT": "1",
    "PYTHONDONTWRITEBYTECODE": "1",
}

# Messaggi di pgzero/loaders.py quando manca una risorsa
RISORSA_MANCANTE = re.compile(
    r"No (?:'\w+' directory found to load (?P<tipo1>image|sound|font|music)|(?P<tipo2>image|sound|font|music) found like) '(?P<nome>[^']+)'"
)
CARTELLE = {"image": ("images", "png"), "sound": ("sounds", "wav"), "font": ("fonts", "ttf"), "music": ("music", None)}


def png(lato=32):
    """PNG RGBA pieno, lato x lato (senza dipendenze)."""
    riga = b"\x00" + b"\xff\x80\x00\xff" * lato
    dati = zlib.compress(riga * lato)

    def blocco(tipo, contenuto):
        return struct.pack(">I", len(contenuto)) + tipo + contenuto + struct.pack(">I", zlib.crc32(tipo + contenuto) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + blocco(b"IHDR", struct.pack(">IIBBBBB", lato, lato, 8, 6, 0, 0, 0)) + blocco(b"IDAT", dati) + blocco(b"IEND", b"")


def wav(percorso):
    with wave.open(str(percorso), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(22050)
        w.writeframes(b"\x00\x00" * 2205)


def crea_segnaposto(cartella_gioco, tipo, nome):
    sottocartella, estensione = CARTELLE[tipo]
    # La musica senza estensione: pgzero la accetta e SDL_mixer riconosce il WAV dal contenuto
    # (con .ogg/.mp3 si fida dell'estensione e lo rifiuta)
    da_aggiungere = "" if tipo == "music" or "." in Path(nome).name else f".{estensione}"
    destinazione = cartella_gioco / sottocartella / f"{nome}{da_aggiungere}"
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    if tipo == "image":
        destinazione.write_bytes(png())
    elif tipo in ("sound", "music"):
        wav(destinazione)
    else:
        font = Path(find_spec("pygame").submodule_search_locations[0]) / "freesansbold.ttf"
        shutil.copyfile(font, destinazione)
    return destinazione.relative_to(cartella_gioco)


def esegui(codice):
    """Restituisce (ok, dettagli)."""
    with tempfile.TemporaryDirectory(prefix="pgzero-") as tmp:
        cartella = Path(tmp)
        (cartella / "main.py").write_text(codice, encoding="utf-8")
        segnaposto = []
        while True:
            try:
                fatto = subprocess.run(
                    [sys.executable, "-m", "pgzero", "main.py"],
                    cwd=cartella, env=AMBIENTE, capture_output=True, text=True, timeout=SECONDI,
                )
            except subprocess.TimeoutExpired:
                return True, f"gira da {SECONDI} s" + (f" (segnaposto: {', '.join(segnaposto)})" if segnaposto else "")
            if fatto.returncode == 0:
                return True, "finito senza errori"
            errore = fatto.stderr.strip() or fatto.stdout.strip()
            mancante = RISORSA_MANCANTE.search(errore)
            if mancante and len(segnaposto) < MAX_SEGNAPOSTO:
                creato = crea_segnaposto(cartella, mancante["tipo1"] or mancante["tipo2"], mancante["nome"])
                if str(creato) not in segnaposto:
                    segnaposto.append(str(creato))
                    continue
            return False, "\n".join(errore.splitlines()[-8:])


def programmi():
    for file in sorted(CASI.glob("*.py")):
        yield f"caso {file.stem}", file.read_text(encoding="utf-8")
    if not TASK_REALI.exists():
        return
    eccezioni = json.loads(ECCEZIONI.read_text(encoding="utf-8")) if ECCEZIONI.exists() else {}
    for task in json.loads(TASK_REALI.read_text(encoding="utf-8"))["task"]:
        chiave = f"{task['tipo']}-{task['id']}"
        if task.get("compilatore") != "pgzero" or not (task.get("default_python_code") or "").strip():
            continue
        if chiave in eccezioni:
            print(f"–  {chiave} {task['titolo']}: saltato ({eccezioni[chiave]})")
            continue
        yield f"{chiave} {task['corso']} L{task['lezione']} «{task['titolo']}»", task["default_python_code"]


def main():
    if find_spec("pgzero") is None:
        print(f"pgzero non è installato per {sys.executable}:")
        print("  python3 -m pip install -r e2e/compilatori/pgzero/requirements.txt")
        print("oppure scegli un altro Python: PYTHON=/percorso/python npm run test:pgzero")
        return 1
    filtro = " ".join(sys.argv[1:]).lower()
    falliti = 0
    provati = 0
    for nome, codice in programmi():
        if filtro and filtro not in nome.lower():
            continue
        provati += 1
        ok, dettagli = esegui(codice)
        print(f"{'✓' if ok else '✗'}  {nome}: {dettagli if ok else ''}")
        if not ok:
            falliti += 1
            print("   " + dettagli.replace("\n", "\n   "))
    print(f"\n{provati - falliti}/{provati} programmi Pygame Zero partono senza errori")
    if provati == 0:
        print("Nessun programma trovato")
        return 1
    return 1 if falliti else 0


if __name__ == "__main__":
    sys.exit(main())

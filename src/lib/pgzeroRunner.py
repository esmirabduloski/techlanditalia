"""
Pygame Zero nel sito: Pyodide + pygame-ce + pgzero 1.2.1 (src/lib/pgzeroRuntime.ts).

Caricato una volta per pagina come modulo `techland_pgzero`, compilato come
"<techland>": negli errori l'ultima riga "<exec>" del traceback resta quella
dell'alunno.

Il mainloop di pgzero (pgzero/game.py, PGZeroGame.mainloop) è un `while True`
che nel browser bloccherebbe la pagina: qui c'è lo stesso ciclo, con una pausa
a ogni frame per lasciare disegnare il browser e arrivare tastiera e mouse.
"""
import asyncio
import os
import shutil
import sys
import time
import types

# La tastiera arriva al gioco solo quando la sua finestra ha il focus
# (scrivere nell'editor non muove il personaggio)
os.environ["SDL_EMSCRIPTEN_KEYBOARD_ELEMENT"] = "#canvas"

# tone genera i suoni con numpy (3 MB in più da scaricare): nel sito non c'è
_tone = types.ModuleType("pgzero.tone")


def _tone_non_disponibile(*args, **kwargs):
    raise RuntimeError("tone non è disponibile nel sito: usa i suoni, per esempio sounds.salto.play()")


_tone.play = _tone.create = _tone_non_disponibile
sys.modules["pgzero.tone"] = _tone

import pygame
import pgzero.animation
import pgzero.clock
import pgzero.keyboard
import pgzero.loaders
import pgzero.music
import pgzero.ptext
import pgzero.runner
from pgzero.game import PGZeroGame

# L'icona della finestra non serve, e pygame-ce nel browser non la carica dalla memoria
PGZeroGame.show_default_icon = staticmethod(lambda: None)

# "import pgzrun" e pgzrun.go() alla fine del codice (come su Replit) non devono fare niente
sys._pgzrun = True

CARTELLA = "/home/pyodide/gioco"
FPS = 60
_fermato = False


def prepara_cartella():
    """Cartella del gioco vuota: la pagina ci scrive immagini, suoni, musiche e font."""
    shutil.rmtree(CARTELLA, ignore_errors=True)
    for sotto in ("images", "sounds", "music", "fonts"):
        os.makedirs(os.path.join(CARTELLA, sotto), exist_ok=True)


def ferma():
    global _fermato
    _fermato = True


def _azzera():
    """Stato di pgzero pulito a ogni Esegui: orologio, tasti, animazioni, file già caricati."""
    orologio = pgzero.clock.clock
    orologio.t = 0
    orologio.fired = False
    orologio.events.clear()
    orologio._each_tick.clear()
    pgzero.keyboard.keyboard._pressed.clear()
    pgzero.animation.Animation.animations.clear()
    pgzero.animation.Animation._animation_dict.clear()
    for loader in (pgzero.loaders.images, pgzero.loaders.sounds, pgzero.loaders.fonts, pgzero.music._loader):
        loader.cache.clear()
        loader.have_root = False
    pgzero.ptext._font_cache.clear()
    pygame.display.init()
    if pygame.mixer.get_init():
        pygame.mixer.stop()
        pygame.mixer.music.stop()


async def esegui(codice, dimensioni):
    """Esegue il gioco finché non finisce o si preme Stop. dimensioni(w, h) dice alla pagina quanto è grande."""
    global _fermato
    _fermato = False
    _azzera()

    mod = types.ModuleType("__main__")
    mod.__file__ = os.path.join(CARTELLA, "main.py")
    pgzero.runner.prepare_mod(mod)
    try:
        exec(compile(codice, "<exec>", "exec"), mod.__dict__)

        game = PGZeroGame(mod)
        game.reinit_screen()
        dimensioni(game.width, game.height)
        update = game.get_update_func()
        draw = game.get_draw_func()
        game.load_handlers()
        orologio = pgzero.clock.clock
        game.need_redraw = True

        ultimo = time.perf_counter()
        while not _fermato:
            inizio = time.perf_counter()
            dt = min(inizio - ultimo, 0.1)
            ultimo = inizio

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if event.type == pygame.KEYDOWN:
                    game.keyboard._press(event.key)
                elif event.type == pygame.KEYUP:
                    game.keyboard._release(event.key)
                game.dispatch_event(event)

            orologio.tick(dt)
            if update:
                update(dt)

            prima = (game.width, game.height)
            game.reinit_screen()
            if (game.width, game.height) != prima:
                dimensioni(game.width, game.height)
                game.need_redraw = True

            if update or orologio.fired or game.need_redraw:
                draw()
                pygame.display.flip()
                game.need_redraw = False

            await asyncio.sleep(max(0, 1 / FPS - (time.perf_counter() - inizio)))
    except SystemExit:
        # exit() nel gioco: finisce senza errore
        pass
    finally:
        if pygame.mixer.get_init():
            pygame.mixer.stop()
            pygame.mixer.music.stop()

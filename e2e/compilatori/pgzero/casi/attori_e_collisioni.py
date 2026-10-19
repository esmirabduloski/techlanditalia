#pgzero
import random

WIDTH = 600
HEIGHT = 400

alieno = Actor("alien")
alieno.pos = 100, 200
moneta = Actor("coin", center=(300, 200))
punti = 0
vite = 3

def sposta_moneta():
    moneta.x = random.randint(20, WIDTH - 20)
    moneta.y = random.randint(20, HEIGHT - 20)

def draw():
    screen.clear()
    screen.fill((30, 30, 60))
    alieno.draw()
    moneta.draw()
    screen.draw.text(f"Punti: {punti}  Vite: {vite}", topleft=(10, 10), color="white")

def update():
    global punti
    alieno.x += 4
    alieno.angle += 2
    if alieno.right > WIDTH:
        alieno.left = 0
    if alieno.colliderect(moneta):
        punti += 1
        sposta_moneta()
    if alieno.collidepoint(moneta.pos):
        punti += 1
    alieno.distance_to(moneta)
    alieno.angle_to(moneta)

def on_mouse_down(pos):
    global vite
    if alieno.collidepoint(pos):
        vite -= 1

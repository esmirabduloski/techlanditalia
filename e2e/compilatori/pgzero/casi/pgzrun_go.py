#pgzero main.py
import pgzrun

WIDTH = 320
HEIGHT = 240
x = 0

def draw():
    screen.fill((0, 100, 0))
    screen.draw.filled_rect(Rect((x, 100), (40, 40)), "white")

def update():
    global x
    x = (x + 3) % WIDTH

pgzrun.go()

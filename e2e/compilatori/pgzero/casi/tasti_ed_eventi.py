WIDTH = 400
HEIGHT = 400

giocatore = Actor("player", (200, 350))
proiettili = []
in_pausa = False

def on_key_down(key):
    global in_pausa
    if key == keys.SPACE:
        proiettili.append(Rect(giocatore.x, giocatore.y, 4, 10))
    if key == keys.P:
        in_pausa = not in_pausa

def on_mouse_move(pos):
    giocatore.x = pos[0]

def draw():
    screen.fill("black")
    giocatore.draw()
    for p in proiettili:
        screen.draw.filled_rect(p, "yellow")

def update():
    if in_pausa:
        return
    if keyboard.a:
        giocatore.x -= 5
    if keyboard[keys.D]:
        giocatore.x += 5
    for p in proiettili:
        p.y -= 8
    proiettili[:] = [p for p in proiettili if p.bottom > 0]

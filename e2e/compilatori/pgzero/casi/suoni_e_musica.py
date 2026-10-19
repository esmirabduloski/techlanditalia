WIDTH = 300
HEIGHT = 200

fotogrammi = 0
music.play("tema")
music.set_volume(0.3)

def draw():
    screen.fill("navy")

def update():
    global fotogrammi
    fotogrammi += 1
    if fotogrammi == 10:
        sounds.salto.play()
    if fotogrammi == 20:
        sounds.load("moneta").play()
    if fotogrammi == 30:
        music.fadeout(0.5)

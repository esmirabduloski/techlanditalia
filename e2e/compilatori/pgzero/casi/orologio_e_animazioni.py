WIDTH = 500
HEIGHT = 300

razzo = Actor("rocket", (50, 150))
tempo = 0
messaggi = []

def conta():
    global tempo
    tempo += 1

def avvisa():
    messaggi.append("via!")

clock.schedule_interval(conta, 0.1)
clock.schedule_unique(avvisa, 0.2)
clock.schedule(avvisa, 0.5)
animate(razzo, pos=(450, 150), duration=1.5, tween="accel_decel")

def draw():
    screen.fill("black")
    razzo.draw()
    screen.draw.text(str(tempo), center=(WIDTH // 2, 30), fontsize=40, color="orange")
    for i, m in enumerate(messaggi):
        screen.draw.text(m, (10, 250 - i * 20))

def update(dt):
    if tempo > 5:
        clock.unschedule(conta)

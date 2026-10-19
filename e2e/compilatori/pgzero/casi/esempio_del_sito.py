# Pygame Zero - Gioco semplice
# Copia questo codice in main.py nell'editor Replit
# (il programma di esempio di src/components/lesson/PgzeroCompiler.tsx)

WIDTH = 400
HEIGHT = 300

player_x = 200
player_y = 150
speed = 5

def draw():
    screen.fill("darkblue")
    screen.draw.filled_circle((player_x, player_y), 20, "yellow")
    screen.draw.text("Usa le frecce!", (50, 20), fontsize=20, color="white")

def update():
    global player_x, player_y

    if keyboard.left and player_x > 20:
        player_x -= speed
    if keyboard.right and player_x < WIDTH - 20:
        player_x += speed
    if keyboard.up and player_y > 20:
        player_y -= speed
    if keyboard.down and player_y < HEIGHT - 20:
        player_y += speed

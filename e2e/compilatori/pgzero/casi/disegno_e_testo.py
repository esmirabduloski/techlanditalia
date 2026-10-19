WIDTH = 640
HEIGHT = 480
TITLE = "Disegni"

def draw():
    screen.blit("sfondo", (0, 0))
    screen.draw.line((0, 0), (WIDTH, HEIGHT), "red")
    screen.draw.circle((320, 240), 50, "white")
    screen.draw.filled_circle((100, 100), 30, (255, 200, 0))
    screen.draw.rect(Rect(10, 400, 100, 50), "cyan")
    screen.draw.filled_rect(Rect((200, 400), (100, 50)), "magenta")
    screen.draw.text("Game over", center=(320, 50), fontsize=60, color="red", fontname="pixel", owidth=1, ocolor="black")
    screen.draw.textbox("Riquadro di testo", Rect(400, 300, 200, 80))

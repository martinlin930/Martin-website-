from flask import Flask, render_template
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates")
)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/work")
def work():
    return render_template("work.html")

if __name__ == "__main__":
    app.run()

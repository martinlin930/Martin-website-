from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Martin Photography</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <style>
            body {
                margin: 0;
                background: #080808;
                color: white;
                font-family: Arial, sans-serif;
            }

            nav {
                padding: 30px 7%;
                display: flex;
                justify-content: space-between;
            }

            .logo {
                font-size: 22px;
                font-weight: bold;
                letter-spacing: 3px;
            }

            nav a {
                color: #aaa;
                text-decoration: none;
                margin-left: 30px;
            }

            .hero {
                height: 75vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 0 7%;
            }

            .hero p {
                color: #777;
                letter-spacing: 4px;
            }

            .hero h1 {
                font-size: clamp(70px, 14vw, 180px);
                margin: 0;
            }

            .hero h2 {
                color: #777;
                font-size: clamp(30px, 5vw, 65px);
                margin: 0;
                font-weight: normal;
            }

            .about {
                padding: 100px 7%;
                max-width: 800px;
            }

            .about h2 {
                font-size: 45px;
            }

            .about p {
                color: #aaa;
                font-size: 20px;
                line-height: 1.7;
            }

            footer {
                padding: 40px 7%;
                border-top: 1px solid #222;
                color: #555;
            }

        .gallery {
    padding: 40px 7%;
}

.gallery img {
    width: 100%;
    height: auto;
    display: block;
}
    </sytle>
    </head>

    <body>

        <nav>
            <div class="logo">MARTIN.</div>

            <div>
                <a href="#">HOME</a>
                <a href="#about">ABOUT</a>
                <a href="#contact">CONTACT</a>
            </div>
        </nav>

        <section class="hero">
            <p>PHOTOGRAPHER / VISUAL STORYTELLER</p>

            <h1>MARTIN</h1>

            <h2>Photography.</h2>
        </section>
<section class="gallery">
    <img src="/static/images/DSC00686-2.JPG" alt="Martin Photography">
</section>
        <section class="about" id="about">
            <h2>About Me</h2>

            <p>
                I'm Martin, a photographer focused on capturing
                moments, places, and stories through my perspective.
            </p>
        </section>

        <footer id="contact">
            © 2026 Martin Photography
        </footer>

    </body>
    </html>
    """

if __name__ == "__main__":
    app.run()

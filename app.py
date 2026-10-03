from flask import Flask

app = Flask(__name__)


@app.route("/")
def home():
    return """
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Martin Photography</title>

    <style>
        * {
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            margin: 0;
            background: #080808;
            color: white;
            font-family: Arial, Helvetica, sans-serif;
        }

        nav {
            padding: 30px 7%;
            display: flex;
            justify-content: space-between;
            align-items: center;
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
            font-size: 14px;
        }

        nav a:hover {
            color: white;
        }

        .hero {
            min-height: 75vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 0 7%;
        }

        .hero p {
            color: #888;
            letter-spacing: 4px;
            font-weight: bold;
        }

        .hero h1 {
            font-size: clamp(70px, 14vw, 180px);
            margin: 0;
            line-height: 0.9;
        }

        .hero h2 {
            color: #888;
            font-size: clamp(30px, 5vw, 65px);
            margin: 20px 0 0 0;
            font-weight: normal;
        }

        .gallery {
            padding: 40px 7%;
        }

        .gallery-title {
            font-size: 14px;
            letter-spacing: 4px;
            color: #888;
            margin-bottom: 25px;
        }

        .gallery img {
            display: block;
            width: 100%;
            max-width: 1200px;
            height: auto;
            margin: 0 auto;
        }

        .about {
            padding: 100px 7%;
            max-width: 900px;
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

        @media (max-width: 700px) {
            nav {
                padding: 25px 5%;
            }

            nav a {
                margin-left: 12px;
                font-size: 11px;
            }

            .hero,
            .gallery,
            .about {
                padding-left: 5%;
                padding-right: 5%;
            }
        }
    </style>
</head>

<body>

    <nav>
        <div class="logo">MARTIN.</div>

        <div>
            <a href="#">HOME</a>
            <a href="#work">WORK</a>
            <a href="#about">ABOUT</a>
            <a href="#contact">CONTACT</a>
        </div>
    </nav>


    <section class="hero">

        <p>PHOTOGRAPHER / VISUAL STORYTELLER</p>

        <h1>MARTIN</h1>

        <h2>Photography.</h2>

    </section>


    <section class="gallery" id="work">

        <div class="gallery-title">SELECTED WORK</div>

        <img
            src="/static/images/DSC00686-2.JPG"
            alt="Martin Photography"
        >

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

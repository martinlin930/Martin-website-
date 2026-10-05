"""Public forum, authenticated publishing; images live in durable database storage."""
import base64
import io
import time
import warnings
from flask import request, session, render_template, Response
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 20_000_000

def install_forum(app, database):
    def error(message, status=400):
        return {'error': message}, status

    def author():
        uid = session.get('user_id')
        if not uid:
            return None
        with database() as db:
            return db.execute('SELECT id,username FROM users WHERE id=?', (uid,)).fetchone()

    def before_id():
        value = request.args.get('before', '')
        return int(value) if value.isdigit() and 0 < int(value) < 2**63 else 2**63-1

    @app.get('/forum')
    def forum_page():
        return render_template('forum.html')

    @app.get('/api/forum/posts')
    def forum_posts():
        with database() as db:
            rows = [dict(r) for r in db.execute('''SELECT p.id,p.display_name,p.body,p.created,
                (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id=p.id) AS comment_count
                FROM forum_posts p WHERE p.id < ? ORDER BY p.id DESC LIMIT 20''', (before_id(),))]
            images = []
            if rows:
                ids = [p['id'] for p in rows]
                images = db.execute('SELECT id,post_id FROM forum_images WHERE post_id IN (' + ','.join('?' for _ in ids) + ') ORDER BY id', tuple(ids)).fetchall()
            for post in rows:
                post['images'] = ['/api/forum/images/'+str(i['id']) for i in images if i['post_id']==post['id']]
        return {'posts': rows, 'next': rows[-1]['id'] if len(rows)==20 else None}

    @app.post('/api/forum/posts')
    def forum_publish():
        user = author()
        if not user:
            return error('登录后才能发动态。', 401)
        body = request.form.get('body', '').strip()
        name = request.form.get('display_name', user['username']).strip()
        files = [f for f in request.files.getlist('photos') if f.filename]
        if len(body)>4000 or not 1<=len(name)<=24 or len(files)>4:
            return error('昵称最多 24 字，正文最多 4000 字，照片最多 4 张。')
        if not body and not files:
            return error('写一点内容，或选一张照片吧。')
        photos=[]
        for file in files:
            raw=file.read(4*1024*1024+1)
            if len(raw)>4*1024*1024:
                return error('每张照片最多 4 MB。')
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter('error', Image.DecompressionBombWarning)
                    with Image.open(io.BytesIO(raw)) as source:
                        if source.format not in ('JPEG','PNG','WEBP'):
                            return error('请选择 JPG、PNG 或 WebP 照片。')
                        source.load()
                        image=ImageOps.exif_transpose(source)
                        image.thumbnail((1600,1600))
                        if image.mode in ('RGBA','LA') or 'transparency' in image.info:
                            rgba=image.convert('RGBA');image=Image.new('RGB',rgba.size,'white');image.paste(rgba,mask=rgba.getchannel('A'))
                        else:
                            image=image.convert('RGB')
                        output=io.BytesIO();image.save(output,'JPEG',quality=82,optimize=True)
                        if output.tell()>700_000:
                            image.thumbnail((1200,1200));output=io.BytesIO();image.save(output,'JPEG',quality=70,optimize=True)
                        photos.append(base64.b64encode(output.getvalue()).decode('ascii'))
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
                return error('这张照片无法读取，请换一张图片。')
        now=time.time()
        with database() as db:
            recent=db.execute('SELECT created FROM forum_posts WHERE user_id=? ORDER BY id DESC LIMIT 1',(user['id'],)).fetchone()
            if recent and now-recent['created']<10:
                return error('发布得太快了，请等 10 秒再发。',429)
            post_id=db.execute('INSERT INTO forum_posts(user_id,display_name,body,created) VALUES(?,?,?,?) RETURNING id',(user['id'],name,body,now)).fetchone()['id']
            for photo in photos:
                db.execute('INSERT INTO forum_images(post_id,jpeg_base64) VALUES(?,?)',(post_id,photo))
        return {'id':post_id},201

    @app.get('/api/forum/images/<int:image_id>')
    def forum_image(image_id):
        with database() as db:
            row=db.execute('SELECT jpeg_base64 FROM forum_images WHERE id=?',(image_id,)).fetchone()
        if not row:
            return error('照片不存在。',404)
        return Response(base64.b64decode(row['jpeg_base64']),mimetype='image/jpeg',headers={'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'})

    @app.get('/api/forum/posts/<int:post_id>/comments')
    def forum_comments(post_id):
        with database() as db:
            if not db.execute('SELECT id FROM forum_posts WHERE id=?',(post_id,)).fetchone():
                return error('动态不存在。',404)
            rows=[dict(r) for r in db.execute('SELECT id,display_name,body,created FROM forum_comments WHERE post_id=? AND id<? ORDER BY id DESC LIMIT 20',(post_id,before_id()))]
        return {'comments':rows[::-1], 'next':rows[-1]['id'] if len(rows)==20 else None}

    @app.post('/api/forum/posts/<int:post_id>/comments')
    def forum_comment(post_id):
        user=author()
        if not user:
            return error('登录后才能评论。',401)
        data=request.get_json(silent=True) or {}
        if not isinstance(data,dict):
            return error('评论格式不正确。')
        body=data.get('body','')
        if not isinstance(body,str) or not 1<=len(body.strip())<=1000:
            return error('评论请输入 1–1000 个字符。')
        now=time.time()
        with database() as db:
            if not db.execute('SELECT id FROM forum_posts WHERE id=?',(post_id,)).fetchone():
                return error('动态不存在。',404)
            recent=db.execute('SELECT created FROM forum_comments WHERE user_id=? ORDER BY id DESC LIMIT 1',(user['id'],)).fetchone()
            if recent and now-recent['created']<2:
                return error('评论得太快了，请稍等 2 秒。',429)
            row=db.execute('INSERT INTO forum_comments(post_id,user_id,display_name,body,created) VALUES(?,?,?,?,?) RETURNING id',(post_id,user['id'],user['username'],body.strip(),now)).fetchone()
        return {'id':row['id']},201

import sqlite3
import time
from app import app, database
import test_world

import unittest

class SaveTests(unittest.TestCase):
    setUp=test_world.WorldTests.setUp
    tearDown=test_world.WorldTests.tearDown
    post=test_world.WorldTests.post
    # Use the world fixtures without inheriting the unrelated test suite.
    def login_as(self, client, name):
        with database() as db:
            db.execute('INSERT OR IGNORE INTO users (username,password_hash) VALUES (?,?)', (name,'test'))
            uid=db.execute('SELECT id FROM users WHERE username=?',(name,)).fetchone()['id']
        with client.session_transaction() as session:
            session.clear();session['user_id']=uid;session['username']=name
        client.get('/world')
        return uid

    def test_save_survives_leave_logout_and_new_session(self):
        uid=self.login_as(self.a,'Alice')
        joined=self.post(self.a,'join',{'nickname':'爱丽丝'}).json
        avatar=joined['state']['avatar']
        self.post(self.a,'state',{'x':75,'z':-130,'yaw':1.5,'pitch':.2,'music_muted':True})
        self.post(self.a,'leave',{})
        with self.a.session_transaction() as s:s.clear()
        self.login_as(self.b,'Alice')
        self.assertIn('爱丽丝',self.b.get('/world').text)
        restored=self.post(self.b,'join',{'nickname':'爱丽丝'}).json
        self.assertTrue(restored['persistent'])
        self.assertEqual(restored['state'],{'x':75,'z':-130,'yaw':1.5,'pitch':.2,'music_muted':1,'avatar':avatar})
        with database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM game_saves WHERE user_id=?',(uid,)).fetchone()[0],1)

    def test_expiration_and_schema_reinitialization_keep_saves(self):
        self.login_as(self.a,'Alice')
        self.post(self.a,'join',{'nickname':'A'})
        self.post(self.a,'state',{'x':90,'z':-140})
        with database() as db:db.execute('UPDATE players SET updated=?',(time.time()-60,))
        self.post(self.b,'join',{'nickname':'Guest'})
        self.post(self.b,'state',{})
        # database() reopens and runs the same additive initialization as a deploy.
        with database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM players WHERE nickname="A"').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT x FROM game_saves').fetchone()[0],90)
        self.assertEqual(self.post(self.a,'join',{'nickname':'A'}).json['state']['x'],90)

    def test_accounts_are_isolated_and_guests_are_temporary(self):
        self.login_as(self.a,'Alice');self.post(self.a,'join',{'nickname':'A'})
        self.post(self.a,'state',{'x':95,'z':-145})
        self.login_as(self.b,'Bob')
        other=self.post(self.b,'join',{'nickname':'B'}).json
        self.assertEqual(other['state']['x'],70.4)
        with self.a.session_transaction() as s:s['user_id']=999
        self.assertEqual(self.post(self.a,'state',{'x':1}).status_code,401)
        guest=app.test_client();guest.get('/world')
        self.assertFalse(self.post(guest,'join',{'nickname':'G'}).json['persistent'])
        self.post(guest,'state',{'x':120});self.post(guest,'leave',{})
        self.assertEqual(self.post(guest,'join',{'nickname':'G'}).json['state']['x'],70.4)
        with database() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM game_saves').fetchone()[0],2)

    def test_old_database_is_migrated_without_erasing_accounts(self):
        with sqlite3.connect(app.config['DATABASE']) as db:
            db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)')
            db.execute('INSERT INTO users VALUES (42,"existing","hash")')
            db.execute('CREATE TABLE players (id TEXT PRIMARY KEY,nickname TEXT NOT NULL,x REAL NOT NULL,z REAL NOT NULL,updated REAL NOT NULL)')
        with database() as db:
            self.assertEqual(db.execute('SELECT username FROM users WHERE id=42').fetchone()[0],'existing')
            self.assertIn('user_id',{r['name'] for r in db.execute('PRAGMA table_info(players)')})

    def test_backup_preserves_saves_and_does_not_overwrite(self):
        self.login_as(self.a,'Alice');self.post(self.a,'join',{'nickname':'A'})
        self.post(self.a,'state',{'x':88,'z':-139})
        target=__import__('pathlib').Path(self.temp.name)/'backup.sqlite3'
        runner=app.test_cli_runner()
        self.assertEqual(runner.invoke(args=['backup-database',str(target)]).exit_code,0)
        backup=sqlite3.connect(target)
        try:self.assertEqual(backup.execute('SELECT x FROM game_saves').fetchone()[0],88)
        finally:backup.close()
        self.assertNotEqual(runner.invoke(args=['backup-database',str(target)]).exit_code,0)

    def test_pet_survives_login_and_is_shared_without_cross_account_writes(self):
        uid=self.login_as(self.a,'Alice')
        joined=self.post(self.a,'join',{'nickname':'A'}).json
        name='小狗 🐶 <>& / 雪'
        self.assertEqual(self.post(self.a,'dog',{'name':name,'user_id':999}).json['dog_name'],name)
        self.post(self.a,'state',{'x':75,'z':-130})
        self.login_as(self.b,'Bob');self.post(self.b,'join',{'nickname':'B'})
        observed=self.post(self.b,'state',{}).json
        self.assertEqual(observed['dog_name'],'')
        self.assertEqual(observed['players'][0]['dog_name'],name)
        self.assertEqual(self.post(self.b,'dog',{'name':'stolen','player_id':joined['id']}).status_code,401)
        for value in ['', ' '*3, 'x'*25, 123]:
            self.assertEqual(self.post(self.a,'dog',{'name':value}).status_code,400)
        self.assertEqual(self.a.post('/api/world/dog',json={'name':'bad'}).status_code,400)
        self.post(self.a,'leave',{})
        with self.a.session_transaction() as session:session.clear()
        self.login_as(self.a,'Alice')
        restored=self.post(self.a,'join',{'nickname':'A'}).json
        self.assertEqual(restored['dog_name'],name)
        self.assertEqual(restored['state']['x'],75)
        self.assertEqual(self.post(self.a,'dog',{'name':'新名字'}).json['dog_name'],'新名字')
        with database() as db:
            self.assertEqual(db.execute('SELECT dog_name FROM game_saves WHERE user_id=?',(uid,)).fetchone()[0],'新名字')
        guest=app.test_client();guest.get('/world');self.post(guest,'join',{'nickname':'G'})
        self.assertEqual(self.post(guest,'dog',{'name':'Guest dog'}).status_code,401)

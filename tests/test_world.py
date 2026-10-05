import tempfile
import unittest
from pathlib import Path
from app import app

class WorldTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        app.config.update(TESTING=True,DATABASE=str(Path(self.temp.name)/'world.sqlite3'))
        self.a=app.test_client();self.b=app.test_client()
        for c in (self.a,self.b):
            c.get('/world')
    def tearDown(self):self.temp.cleanup()
    def post(self,c,path,body):
        with c.session_transaction() as s:token=s['csrf_token']
        return c.post('/api/world/'+path,json=body,headers={'X-CSRF-Token':token})
    def test_multiplayer_chat_leave(self):
        self.assertEqual(self.post(self.a,'state',{}).status_code,401)
        self.post(self.a,'join',{'nickname':'Alice'});self.post(self.b,'join',{'nickname':'Bob'})
        self.post(self.a,'state',{'x':3,'z':4,'yaw':1.2})
        state=self.post(self.b,'state',{}).json
        self.assertEqual(state['players'][0]['nickname'],'Alice')
        self.assertEqual(state['players'][0]['x'],3)
        self.assertEqual(state['players'][0]['yaw'],1.2)
        self.assertEqual(self.post(self.a,'chat',{'message':'你好 🌍 <>& / \\ " hello'}).status_code,200)
        self.assertEqual(self.post(self.b,'state',{}).json['messages'][0]['body'],'你好 🌍 <>& / \\ " hello')
        self.assertEqual(self.post(self.a,'chat',{'message':'Again'}).status_code,429)
        self.post(self.a,'leave',{})
        self.assertEqual(self.post(self.b,'state',{}).json['players'],[])
    def test_validation(self):
        self.assertEqual(self.post(self.a,'join',{'nickname':' '}).status_code,400)
        self.post(self.a,'join',{'nickname':'Alice'})
        self.assertEqual(self.post(self.a,'state',{'x':'bad'}).status_code,400)
        self.assertEqual(self.post(self.a,'chat',{'message':'x'*2001}).status_code,400)
        self.assertEqual(self.a.post('/api/world/chat',json={'message':'Hi'}).status_code,400)

    def test_two_tabs_have_distinct_players(self):
        first=self.post(self.a,'join',{'nickname':'First'}).json['id']
        second=self.post(self.a,'join',{'nickname':'Second'}).json['id']
        self.assertNotEqual(first,second)
        self.post(self.a,'state',{'player_id':first,'x':5,'z':6,'yaw':2})
        state=self.post(self.a,'state',{'player_id':second,'x':0,'z':0}).json
        peer=next(p for p in state['players'] if p['id']==first)
        self.assertEqual((peer['x'],peer['z'],peer['yaw']),(5,6,2))
        self.assertEqual(self.post(self.a,'state',{'player_id':'unowned'}).status_code,401)

    def test_avatar_is_random_on_entry_and_stable_while_walking(self):
        from unittest.mock import patch
        with patch('app.secrets.choice', side_effect=['01f','02m']):
            first=self.post(self.a,'join',{'nickname':'First'}).json['id']
            self.post(self.b,'join',{'nickname':'Observer'})
        for position in [0,3]:
            self.post(self.a,'state',{'player_id':first,'x':position})
            peer=next(p for p in self.post(self.b,'state',{}).json['players'] if p['id']==first)
            self.assertEqual(peer['avatar'],'01f')
        self.post(self.a,'leave',{'player_id':first})
        with patch('app.secrets.choice', return_value='02f'):
            again=self.post(self.a,'join',{'nickname':'First'}).json['id']
        peer=next(p for p in self.post(self.b,'state',{}).json['players'] if p['id']==again)
        self.assertEqual(peer['avatar'],'02f')

import json,unittest
from app import database
import test_saves
class MountTests(unittest.TestCase):
 setUp=test_saves.SaveTests.setUp;tearDown=test_saves.SaveTests.tearDown;post=test_saves.SaveTests.post;login_as=test_saves.SaveTests.login_as
 def test_only_owned_pets_can_be_mounted(self):
  self.post(self.a,'join',{'nickname':'Guest'});self.assertEqual(self.post(self.a,'mount',{'kind':'Dog'}).status_code,401)
  uid=self.login_as(self.b,'Owner');self.post(self.b,'join',{'nickname':'Owner'})
  for kind in ['Dog','Horse','Pig','unknown']:
   self.assertEqual(self.post(self.b,'mount',{'kind':kind}).status_code,400)
  with database() as db:db.execute('UPDATE game_saves SET dog_name=?,dog_xp=100,dog_food=3 WHERE user_id=?',('Buddy',uid))
  self.assertEqual(self.post(self.b,'mount',{'kind':'Dog'}).json['animals']['riding'],'Dog')
  state=self.post(self.a,'state',{}).json;self.assertEqual(next(p for p in state['players'] if p['nickname']=='Owner')['riding'],'Dog')
  self.assertIsNone(self.post(self.b,'mount',{'kind':None}).json['animals']['riding'])
  with database() as db:
   saved=db.execute('SELECT * FROM game_saves WHERE user_id=?',(uid,)).fetchone();self.assertEqual(saved['dog_xp'],100);self.assertEqual(saved['dog_food'],3)
 def test_animal_mount_is_saved_and_synced(self):
  uid=self.login_as(self.a,'Rider');self.post(self.a,'join',{'nickname':'Rider'})
  with database() as db:db.execute('UPDATE game_saves SET animal_pets=? WHERE user_id=?',(json.dumps({'Horse':{'name':'Star','xp':250},'Pig':{'name':'Pink','xp':100}}),uid))
  self.assertEqual(self.post(self.a,'mount',{'kind':'Horse'}).json['animals']['active'],'Horse')
  restored=self.post(self.a,'join',{'nickname':'Rider'}).json;self.assertEqual(restored['animals']['riding'],'Horse')
  self.post(self.b,'join',{'nickname':'Viewer'});peers=self.post(self.b,'state',{}).json['players'];self.assertTrue(any(p.get('riding')=='Horse' for p in peers))
  self.post(self.a,'animal',{'action':'adopt','kind':'Pig','name':'Pink'})
  self.assertIsNone(self.post(self.a,'state',{}).json['animals']['riding'])
  with database() as db:self.assertEqual(json.loads(db.execute('SELECT animal_pets FROM game_saves WHERE user_id=?',(uid,)).fetchone()[0])['Horse']['xp'],250)
 def test_invalid_player_and_csrf_are_rejected(self):
  self.login_as(self.a,'Owner');self.post(self.a,'join',{'nickname':'Owner'})
  self.assertEqual(self.a.post('/api/world/mount',json={'kind':'Dog'}).status_code,400)
  with self.a.session_transaction() as s:token=s['csrf_token']
  self.assertEqual(self.a.post('/api/world/mount',json={'kind':'Dog','player_id':'foreign'},headers={'X-CSRF-Token':token}).status_code,401)

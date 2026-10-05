import unittest
from app import app,database
import test_world
class RoomTests(unittest.TestCase):
 setUp=test_world.WorldTests.setUp
 tearDown=test_world.WorldTests.tearDown
 post=test_world.WorldTests.post
 def test_door_shared_and_survives_database_reopen(self):
  self.post(self.a,'join',{'nickname':'A'});self.post(self.b,'join',{'nickname':'B'})
  self.assertEqual(self.post(self.a,'room-door',{}).status_code,400)
  self.post(self.a,'state',{'x':58,'z':-129})
  self.assertTrue(self.post(self.a,'room-door',{}).json['room_open'])
  self.assertTrue(self.post(self.b,'state',{}).json['room_open'])
  with database() as db:self.assertEqual(db.execute("SELECT value FROM world_objects WHERE name='room-door'").fetchone()['value'],1)
  self.assertFalse(self.post(self.a,'room-door',{}).json['room_open'])
 def test_door_requires_world_identity_and_csrf(self):
  self.assertEqual(self.post(self.a,'room-door',{}).status_code,401)
  self.post(self.a,'join',{'nickname':'A'})
  self.assertEqual(self.a.post('/api/world/room-door',json={}).status_code,400)
  self.assertEqual(self.post(self.a,'room-door',{'player_id':'not-mine'}).status_code,401)

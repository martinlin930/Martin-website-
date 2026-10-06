import unittest
import test_world
from app import database
class SpeechTests(unittest.TestCase):
 setUp=test_world.WorldTests.setUp;tearDown=test_world.WorldTests.tearDown;post=test_world.WorldTests.post
 def test_message_keeps_server_player_identity_and_timestamp(self):
  a=self.post(self.a,'join',{'nickname':'Same'}).json
  b=self.post(self.b,'join',{'nickname':'Same'}).json
  sent=self.post(self.a,'chat',{'message':'你好 🌙 <script>','player_id':a['id']})
  self.assertEqual(sent.status_code,200)
  message=self.post(self.b,'state',{}).json['messages'][-1]
  self.assertEqual(message['player_id'],a['id']);self.assertNotEqual(message['player_id'],b['id'])
  self.assertEqual(message['body'],'你好 🌙 <script>');self.assertIsInstance(message['created'],float)
  self.assertEqual(self.post(self.b,'chat',{'message':'fake','player_id':a['id']}).status_code,401)

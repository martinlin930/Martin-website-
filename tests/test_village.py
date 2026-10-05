import json
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'static/models/village'

class VillageTests(unittest.TestCase):
    def test_import_scale_restores_road_connection(self):
        scene = json.loads((ROOT / 'scene.json').read_text())
        bounds = json.loads((ROOT / 'bounds.json').read_text())
        road = '3ef9b7071c46a3f45976a05d026518bd'
        length = bounds[road]['max'][2] * scene['importScales'][road]
        self.assertAlmostEqual(length, 27, places=3)
        def nodes(items):
            for node in items:
                yield node
                yield from nodes(node.get('children', []))
        all_nodes = list(nodes(scene['nodes']))
        start = next(n for n in all_nodes if n['position'] == [76.8, 3.0031128, 139.2])
        next_road = next(n for n in all_nodes if n['name']=='SM_road_straight (1)' and n['position'][0]>50)
        angle = 2*math.atan2(start['rotation'][1], start['rotation'][3])
        end_x = start['position'][0]-math.sin(angle)*length
        end_z = start['position'][2]-math.cos(angle)*length
        self.assertLess(math.hypot(end_x-next_road['position'][0], end_z-next_road['position'][2]), .25)

    def test_material_detail_maps_exist(self):
        scene = json.loads((ROOT / 'scene.json').read_text())
        normals = {m['normal'] for m in scene['materials'].values() if m.get('normal')}
        self.assertGreater(len(normals), 20)
        for guid in normals:
            self.assertTrue((ROOT / (guid + '.webp')).is_file(), guid)

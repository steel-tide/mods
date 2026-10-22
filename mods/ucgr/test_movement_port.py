import unittest
import rw
from weapons import source_index
from movement_port import source_movement

class SourceMovementTests(unittest.TestCase):
    def test_fpv_sliding_constants_and_zero_attack_braking_are_source_values(self):
        for name,speed,deceleration in [('FPV',2.85,1),('FPVPG7V',3.25,0),('FPVRPOM',3.25,0)]:
            with self.subTest(name=name):
                ini=rw.load_unit(rw.RW/source_index()[name]['source'])
                self.assertEqual(source_movement(ini),dict(speed=speed,acceleration=1,deceleration=deceleration,turn=9,turnAcceleration=9,yScale=1))
                ini['core']['disableAllUnitCollisions']='false'
                self.assertIsNone(source_movement(ini))
    def test_ground_reverse_is_not_invented_without_source_path_state(self):
        ini=rw.load_unit(rw.RW/source_index()['T90M']['source'])
        self.assertIsNone(source_movement(ini))

if __name__=='__main__':unittest.main()

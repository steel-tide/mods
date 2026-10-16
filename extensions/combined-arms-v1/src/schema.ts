import { readComponentsDef, readComponentsWeapon } from './componentsSpec';
import { readLogisticsDef, readLogisticsWeapon } from './logisticsSpec';
import { readSensorsDef, readGuidanceDef } from './sensorsSpec';
import { readArticulationDef, validateArticulationReferences } from './articulationSpec';
export const capabilities = [
 { id: 'components-v1', definition: readComponentsDef, weapon: readComponentsWeapon },
 { id: 'logistics-v1', definition: readLogisticsDef, weapon: readLogisticsWeapon },
 { id: 'sensors-v1', definition: readSensorsDef, weapon: readGuidanceDef },
 { id: 'articulation-v1', definition: readArticulationDef, references: validateArticulationReferences },
];

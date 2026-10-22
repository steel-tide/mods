import { literalProfiles } from './sourceProfiles';
import { SQUADS_ID, readSquadDef, readSquadWeapon, validateSquadReferences } from './squadsSpec';
import { TARGETING_ID, readSourceTags, readTargetRestrictions } from './targetingSpec';
import { readComponentsDef, readComponentsWeapon, validateComponentsReferences } from './componentsSpec';
import { readLogisticsDef, readLogisticsWeapon } from './logisticsSpec';
import { readSensorsDef, readGuidanceDef, validateSensorsReferences } from './sensorsSpec';
import { readArticulationDef, readArticulationWeapon, validateArticulationReferences } from './articulationSpec';
import { FEEDBACK_ID, readFeedbackDef, validateFeedbackReferences } from './feedbackSpec';
export const capabilities = [
 { id: SQUADS_ID, definition: literalProfiles(readSquadDef), weapon: literalProfiles(readSquadWeapon), references: validateSquadReferences },
 { id: TARGETING_ID, definition: literalProfiles(readSourceTags), weapon: literalProfiles(readTargetRestrictions) },
 { id: 'components-v1', definition: literalProfiles(readComponentsDef), weapon: literalProfiles(readComponentsWeapon), references: validateComponentsReferences },
 { id: 'logistics-v1', definition: literalProfiles(readLogisticsDef), weapon: literalProfiles(readLogisticsWeapon) },
 { id: 'sensors-v1', definition: literalProfiles(readSensorsDef), weapon: literalProfiles(readGuidanceDef), references: validateSensorsReferences },
 { id: 'articulation-v1', definition: literalProfiles(readArticulationDef), weapon: literalProfiles(readArticulationWeapon), references: validateArticulationReferences },
 { id: FEEDBACK_ID, definition: literalProfiles(readFeedbackDef), references: validateFeedbackReferences },
];

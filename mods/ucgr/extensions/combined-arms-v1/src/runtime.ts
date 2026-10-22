import { SQUADS_ID } from './squadsSpec';
import { createSquadsModule } from './squads';
import { createTargetingModule } from './targeting';
import { TARGETING_ID } from './targetingSpec';
import { createComponentsModule } from './components';
import { createLogisticsModule } from './logistics';
import { createSensorsModule } from './sensors';
import { createArticulationModule } from './articulation';
import { createFeedbackModule } from './feedback';
import { FEEDBACK_ID } from './feedbackSpec';
export const capabilities = [
 { id: SQUADS_ID, create: createSquadsModule },
 // Attachment detach-on-order observes player movement before component failures stop it.
 { id: 'articulation-v1', create: createArticulationModule },
 { id: 'components-v1', create: createComponentsModule },
 { id: 'logistics-v1', create: createLogisticsModule },
 { id: 'sensors-v1', create: createSensorsModule },
 { id: TARGETING_ID, create: createTargetingModule },
 { id: FEEDBACK_ID, create: createFeedbackModule },
];

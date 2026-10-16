import { createComponentsModule } from './components';
import { createLogisticsModule } from './logistics';
import { createSensorsModule } from './sensors';
import { createArticulationModule } from './articulation';
export const capabilities = [
 { id: 'components-v1', create: createComponentsModule },
 { id: 'logistics-v1', create: createLogisticsModule },
 { id: 'sensors-v1', create: createSensorsModule },
 { id: 'articulation-v1', create: createArticulationModule },
];

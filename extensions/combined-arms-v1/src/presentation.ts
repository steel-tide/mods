import {createContentRenderer} from './contentRenderer';
import {createContentInput} from './contentInput';
import type {PresentationConstructors} from '../../../../steel-tide/game/core/src/game/extensions/contracts';
export function presentation(base:PresentationConstructors):PresentationConstructors {
 return {Renderer:createContentRenderer(base.Renderer),Input:createContentInput(base.Input)};
}

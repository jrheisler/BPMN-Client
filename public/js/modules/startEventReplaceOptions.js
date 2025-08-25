import { START_EVENT as DEFAULT_START_EVENT } from 'bpmn-js/lib/features/replace/ReplaceOptions';

// Filter out intermediate throw and end event targets, keeping only start event variations
export const START_EVENT = DEFAULT_START_EVENT.filter(option => {
  const targetType = option?.target?.type;
  return targetType !== 'bpmn:IntermediateThrowEvent' && targetType !== 'bpmn:EndEvent';
});

export default START_EVENT;

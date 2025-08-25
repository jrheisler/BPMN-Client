import inherits from 'inherits';
import ReplaceMenuProvider from 'bpmn-js/lib/features/popup-menu/ReplaceMenuProvider';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import * as replaceOptions from 'bpmn-js/lib/features/replace/ReplaceOptions';

import { START_EVENT as CUSTOM_START_EVENT } from './startEventReplaceOptions';

export function CustomReplaceMenuProvider(
  bpmnFactory,
  popupMenu,
  modeling,
  moddle,
  bpmnReplace,
  rules,
  translate,
  moddleCopy
) {
  ReplaceMenuProvider.call(this,
    bpmnFactory,
    popupMenu,
    modeling,
    moddle,
    bpmnReplace,
    rules,
    translate,
    moddleCopy
  );
}

CustomReplaceMenuProvider.$inject = ReplaceMenuProvider.$inject;

inherits(CustomReplaceMenuProvider, ReplaceMenuProvider);

CustomReplaceMenuProvider.prototype.getPopupMenuEntries = function(target) {
  const businessObject = target.businessObject;

  if (is(businessObject, 'bpmn:StartEvent') && !is(businessObject.$parent, 'bpmn:SubProcess')) {
    const originalStart = replaceOptions.START_EVENT;
    replaceOptions.START_EVENT = CUSTOM_START_EVENT;
    const entries = ReplaceMenuProvider.prototype.getPopupMenuEntries.call(this, target);
    replaceOptions.START_EVENT = originalStart;
    return entries;
  }

  return ReplaceMenuProvider.prototype.getPopupMenuEntries.call(this, target);
};

export default {
  __init__: ['replaceMenuProvider'],
  replaceMenuProvider: ['type', CustomReplaceMenuProvider]
};

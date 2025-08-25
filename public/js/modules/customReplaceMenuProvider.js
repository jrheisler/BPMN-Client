import ReplaceMenuProvider from 'bpmn-js/lib/features/popup-menu/ReplaceMenuProvider.js';
import { is } from 'bpmn-js/lib/util/ModelUtil.js';
import * as replaceOptions from 'bpmn-js/lib/features/replace/ReplaceOptions.js';

import { START_EVENT as CUSTOM_START_EVENT } from './startEventReplaceOptions.js';

export class CustomReplaceMenuProvider extends ReplaceMenuProvider {
  constructor(
    bpmnFactory,
    popupMenu,
    modeling,
    moddle,
    bpmnReplace,
    rules,
    translate,
    moddleCopy
  ) {
    super(
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

  getPopupMenuEntries(target) {
    const businessObject = target.businessObject;

    if (is(businessObject, 'bpmn:StartEvent') && !is(businessObject.$parent, 'bpmn:SubProcess')) {
      const originalStart = replaceOptions.START_EVENT;
      replaceOptions.START_EVENT = CUSTOM_START_EVENT;
      const entries = super.getPopupMenuEntries(target);
      replaceOptions.START_EVENT = originalStart;
      return entries;
    }

    return super.getPopupMenuEntries(target);
  }
}

CustomReplaceMenuProvider.$inject = ReplaceMenuProvider.$inject;

export default {
  __init__: ['replaceMenuProvider'],
  replaceMenuProvider: ['type', CustomReplaceMenuProvider]
};

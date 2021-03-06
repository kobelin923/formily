import { createModel } from '../shared/model'
import {
  IModelSpec,
  IFieldState,
  IFieldStateProps,
  FieldStateDirtyMap
} from '../types'
import {
  FormPath,
  isFn,
  toArr,
  isValid,
  isEqual,
  isEmpty,
  isArr
} from '@formily/shared'
import { Draft, original } from 'immer'

const normalizeMessages = (messages: any) => toArr(messages).filter(v => !!v)

const DEEP_INSPECT_PROPERTY_KEYS = [
  'props',
  'rules',
  'errors',
  'warnings',
  'effectErrors',
  'effectWarnings',
  'ruleErrors',
  'ruleWarnings'
]

const getOriginalValue = (value: any) => {
  const origin = original(value)
  return isValid(origin) ? origin : value
}

export const ARRAY_UNIQUE_TAG = Symbol.for(
  '@@__YOU_CAN_NEVER_REMOVE_ARRAY_UNIQUE_TAG__@@'
)

export const parseArrayTags = (value: any[]) => {
  if (!isArr(value)) return []
  return value?.reduce?.((buf, item: any) => {
    return item?.[ARRAY_UNIQUE_TAG] ? buf.concat(item[ARRAY_UNIQUE_TAG]) : buf
  }, [])
}

export const tagArrayList = (current: any[], name: string, force?: boolean) => {
  return current?.map?.((item, index) => {
    if (typeof item === 'object') {
      item[ARRAY_UNIQUE_TAG] = force
        ? `${name}.${index}`
        : item[ARRAY_UNIQUE_TAG] || `${name}.${index}`
    }
    return item
  })
}

export const Field = createModel<IFieldState, IFieldStateProps>(
  class FieldStateFactory implements IModelSpec<IFieldState, IFieldStateProps> {
    nodePath: FormPath

    dataPath: FormPath

    props: IFieldStateProps

    prevState: IFieldState

    lastCompareResults?: boolean

    state = {
      name: '',
      path: '',
      dataType: 'any',
      initialized: false,
      pristine: true,
      valid: true,
      modified: false,
      touched: false,
      active: false,
      visited: false,
      invalid: false,
      visible: true,
      display: true,
      loading: false,
      validating: false,
      errors: [],
      values: [],
      ruleErrors: [],
      ruleWarnings: [],
      effectErrors: [],
      warnings: [],
      effectWarnings: [],
      editable: true,
      selfEditable: undefined,
      formEditable: undefined,
      value: undefined,
      visibleCacheValue: undefined,
      initialValue: undefined,
      rules: [],
      required: false,
      mounted: false,
      unmounted: false,
      unmountRemoveValue: true,
      props: {}
    }

    constructor(props: IFieldStateProps = {}) {
      this.nodePath = FormPath.getPath(props.nodePath)
      this.dataPath = FormPath.getPath(props.dataPath)
      this.state.name = this.dataPath.entire
      this.state.path = this.nodePath.entire
      this.state.dataType = props.dataType
      this.props = props
    }

    getValueFromProps() {
      if (isFn(this.props?.getValue)) {
        return this.props.getValue(this.state.name)
      }
      return this.state.value
    }

    getInitialValueFromProps() {
      if (isFn(this.props?.getInitialValue)) {
        const initialValue = this.props.getInitialValue(this.state.name)
        return isValid(this.state.initialValue)
          ? this.state.initialValue
          : initialValue
      }
      return this.state.initialValue
    }

    dirtyCheck(path: string[], value: any, nextValue: any) {
      const propName = path[0]
      if (DEEP_INSPECT_PROPERTY_KEYS.includes(propName)) {
        return !isEqual(value, nextValue)
      } else {
        return value !== nextValue
      }
    }

    getState = () => {
      if (!this.state.initialized) return this.state
      let value = this.getValueFromProps()
      let initialValue = this.getInitialValueFromProps()
      if (this.isArrayList()) {
        value = this.tagArrayList(toArr(value))
        initialValue = this.tagArrayList(toArr(initialValue))
      }

      const state = {
        ...this.state,
        initialValue,
        value,
        values: [value].concat(this.state.values.slice(1))
      }
      const compareResults = isEqual(this.state.value, value)
      if (!compareResults && compareResults !== this.lastCompareResults) {
        this.state.value = value
        this.props?.unControlledValueChanged?.()
      }
      this.lastCompareResults = compareResults
      return state
    }

    produceErrorsAndWarnings(
      draft: Draft<IFieldState>,
      dirtys: FieldStateDirtyMap
    ) {
      if (dirtys.errors) {
        draft.effectErrors = normalizeMessages(draft.errors)
      }
      if (dirtys.warnings) {
        draft.effectWarnings = normalizeMessages(draft.warnings)
      }
      if (dirtys.effectErrors) {
        draft.effectErrors = normalizeMessages(draft.effectErrors)
      }
      if (dirtys.effectWarnings) {
        draft.effectWarnings = normalizeMessages(draft.effectWarnings)
      }
      if (dirtys.ruleErrors) {
        draft.ruleErrors = normalizeMessages(draft.ruleErrors)
      }
      if (dirtys.ruleWarnings) {
        draft.ruleWarnings = normalizeMessages(draft.ruleWarnings)
      }
      draft.errors = draft.ruleErrors.concat(draft.effectErrors)
      draft.warnings = draft.ruleWarnings.concat(draft.effectWarnings)
    }

    produceEditable(draft: Draft<IFieldState>, dirtys: FieldStateDirtyMap) {
      if (dirtys.editable) {
        draft.selfEditable = draft.editable
      }
      draft.editable = isValid(draft.selfEditable)
        ? draft.selfEditable
        : isValid(draft.formEditable)
        ? isFn(draft.formEditable)
          ? draft.formEditable(draft.name)
          : draft.formEditable
        : true
    }

    produceSideEffects(draft: Draft<IFieldState>, dirtys: FieldStateDirtyMap) {
      if (dirtys.validating) {
        if (draft.validating === true) {
          draft.loading = true
        } else if (draft.validating === false) {
          draft.loading = false
        }
      }
      if (
        dirtys.editable ||
        dirtys.selfEditable ||
        draft.visible === false ||
        draft.unmounted === true
      ) {
        draft.errors = []
        draft.effectErrors = []
        draft.warnings = []
        draft.effectWarnings = []
      }
      if (!isValid(draft.props)) {
        draft.props = {}
      }
      if (draft.mounted === true && dirtys.mounted) {
        draft.unmounted = false
      }
      if (draft.mounted === false && dirtys.mounted) {
        draft.unmounted = true
      }
      if (draft.unmounted === true && dirtys.unmounted) {
        draft.mounted = false
      }
      if (draft.unmounted === false && dirtys.unmounted) {
        draft.mounted = true
      }
      if (dirtys.visible || dirtys.mounted || dirtys.unmounted) {
        if (
          draft.unmountRemoveValue &&
          this.props?.needRemoveValue?.(this.state.path)
        ) {
          if (draft.display) {
            if (draft.visible === false || draft.unmounted === true) {
              if (!dirtys.visibleCacheValue) {
                draft.visibleCacheValue = isValid(draft.value)
                  ? draft.value
                  : isValid(draft.visibleCacheValue)
                  ? draft.visibleCacheValue
                  : draft.initialValue
              }
              draft.value = undefined
              draft.values = toArr(draft.values)
              draft.values[0] = undefined
              this.props.setValue?.(this.state.name, undefined)
            } else if (
              draft.visible === true ||
              draft.mounted === true ||
              draft.unmounted === false
            ) {
              if (!isValid(draft.value)) {
                draft.value = draft.visibleCacheValue
                this.props.setValue?.(
                  this.state.name,
                  getOriginalValue(draft.value)
                )
              }
            }
          }
        } else {
          if (draft.display) {
            if (draft.visible === false) {
              if (!dirtys.visibleCacheValue) {
                draft.visibleCacheValue = isValid(draft.value)
                  ? draft.value
                  : isValid(draft.visibleCacheValue)
                  ? draft.visibleCacheValue
                  : draft.initialValue
              }
              draft.value = undefined
              draft.values = toArr(draft.values)
              draft.values[0] = undefined
              this.props.setValue?.(this.state.name, undefined)
            } else if (draft.visible === true) {
              if (!isValid(draft.value)) {
                draft.value = draft.visibleCacheValue
                this.props.setValue?.(
                  this.state.name,
                  getOriginalValue(draft.value)
                )
              }
            }
          }
        }
      }

      if (draft.errors.length) {
        draft.invalid = true
        draft.valid = false
      } else {
        draft.invalid = false
        draft.valid = true
      }
    }

    tagArrayList(value: any[]) {
      return tagArrayList(value, this.state.name)
    }

    isArrayList() {
      return /array/gi.test(this.state.dataType)
    }

    produceValue(draft: Draft<IFieldState>, dirtys: FieldStateDirtyMap) {
      let valueOrInitialValueChanged =
        dirtys.values || dirtys.value || dirtys.initialValue
      let valueChanged = dirtys.values || dirtys.value
      if (dirtys.values) {
        draft.values = toArr(draft.values)
        if (this.isArrayList()) {
          draft.values[0] = this.tagArrayList(toArr(draft.values[0]))
        }
        draft.value = draft.values[0]
        draft.modified = true
      }
      if (dirtys.value) {
        if (this.isArrayList()) {
          draft.value = this.tagArrayList(toArr(draft.value))
        }
        draft.values[0] = draft.value
        draft.modified = true
      }
      if (dirtys.initialized) {
        const isEmptyValue = !isValid(draft.value) || isEmpty(draft.value)
        if (isEmptyValue && isValid(draft.initialValue)) {
          draft.value = draft.initialValue
          draft.values = toArr(draft.values)
          draft.values[0] = draft.value
          valueChanged = true
          valueOrInitialValueChanged = true
        }
      }
      if (valueChanged) {
        this.props.setValue?.(this.state.name, getOriginalValue(draft.value))
      }
      if (dirtys.initialValue) {
        this.props.setInitialValue?.(
          this.state.name,
          getOriginalValue(draft.initialValue)
        )
      }
      if (valueOrInitialValueChanged) {
        if (isEqual(draft.initialValue, draft.value)) {
          draft.pristine = true
        } else {
          draft.pristine = false
        }
      }
    }

    getRulesFromRulesAndRequired(
      rules: IFieldState['rules'],
      required: boolean
    ) {
      if (isValid(required)) {
        if (rules.length) {
          if (!rules.some(rule => rule && isValid(rule!['required']))) {
            return rules.concat([{ required }])
          } else {
            return rules.reduce((buf: any[], item: any) => {
              const keys = Object.keys(item || {})
              if (isValid(item.required)) {
                if (isValid(item.message)) {
                  if (keys.length > 2) {
                    return buf.concat({
                      ...item,
                      required
                    })
                  }
                } else {
                  if (keys.length > 1) {
                    return buf.concat({
                      ...item,
                      required
                    })
                  }
                }
              }
              if (isValid(item.required)) {
                return buf.concat({
                  ...item,
                  required
                })
              }
              return buf.concat(item)
            }, [])
          }
        } else {
          if (required === true) {
            return rules.concat([
              {
                required
              }
            ])
          }
        }
      }
      return rules
    }

    getRequiredFromRulesAndRequired(rules: any[], required: boolean) {
      for (let i = 0; i < rules.length; i++) {
        if (isValid(rules[i].required)) {
          return rules[i].required
        }
      }
      return required
    }

    produceRules(draft: Draft<IFieldState>, dirtys: FieldStateDirtyMap) {
      if (isValid(draft.rules)) {
        draft.rules = toArr(draft.rules)
      }
      if ((dirtys.required && dirtys.rules) || dirtys.required) {
        const rules = this.getRulesFromRulesAndRequired(
          draft.rules,
          draft.required
        )
        draft.required = draft.required
        draft.rules = rules
      } else if (dirtys.rules) {
        draft.required = this.getRequiredFromRulesAndRequired(
          draft.rules,
          draft.required
        )
      }
    }

    produce(draft: Draft<IFieldState>, dirtys: FieldStateDirtyMap) {
      this.produceErrorsAndWarnings(draft, dirtys)
      this.produceEditable(draft, dirtys)
      this.produceValue(draft, dirtys)
      this.produceSideEffects(draft, dirtys)
      this.produceRules(draft, dirtys)
    }

    static defaultProps = {
      path: '',
      dataType: 'any'
    }

    static displayName = 'FieldState'
  }
)

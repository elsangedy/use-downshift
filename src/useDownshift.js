import { useRef, useState, useEffect } from 'react'

import setA11yStatus from './setA11yStatus'
import usePrevious from './usePrevious'
import {
  noop,
  pickState,
  generateId,
  normalizeArrowKey,
  callAll,
  callAllEventHandlers,
  getNextWrappingIndex,
  isOrContainsNode,
  scrollIntoView,
  debounce,
  getA11yStatusMessage,
  cbToCb,
} from './utils'

const defaultParams = {
  defaultHighlightedIndex: null,
  defaultIsOpen: false,
  getA11yStatusMessage,
  itemToString: i => {
    if (i == null) {
      return ''
    }

    return String(i)
  },
  onStateChange: noop,
  onInputValueChange: noop,

  onUserAction: noop,
  onChange: noop,
  onSelect: noop,
  onOuterClick: noop,
  selectedItemChanged: (prevItem, item) => prevItem !== item,
  stateReducer: (_, stateToSet) => stateToSet,
  scrollIntoView,
}

const initialState = {
  items: [],
  itemCount: null,
  isOpen: false,
  inputValue: '',
  selectedItem: null,
  highlightedIndex: null,
}

function useDownshift(params) {
  params = {
    ...defaultParams,
    ...params,
  }

  params.id = params.id || `use-downshift-${generateId()}`
  params.menuId = params.menuId || `${params.id}-menu`
  params.labelId = params.labelId || `${params.id}-label`
  params.inputId = params.inputId || `${params.id}-input`
  params.getItemId = params.getItemId || (index => `${params.id}-item-${index}`)

  const [state, setState] = useState({
    ...initialState,
    isOpen: params.defaultIsOpen,
    highlightedIndex: params.defaultHighlightedIndex,
  })

  const previousState = usePrevious(state)
  const previousParams = usePrevious(params)

  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const itemsRef = useRef([])
  const itemCountRef = useRef(null)
  const avoidScrollingRef = useRef(null)
  const timeoutsIdsRef = useRef([])
  const isMouseDownRef = useRef(false)
  const isTouchMoveRef = useRef(false)
  const previousResultCountRef = useRef(0)

  useEffect(() => {
    const targetWithinDownshift = (target, checkActiveElement = true) => {
      return [rootRef.current, menuRef.current].some(
        contextNode =>
          contextNode &&
          (isOrContainsNode(contextNode, target) ||
            (checkActiveElement &&
              isOrContainsNode(contextNode, window.document.activeElement))),
      )
    }

    const onMouseDown = () => {
      isMouseDownRef.current = true
    }

    const onMouseUp = event => {
      isMouseDownRef.current = false

      const contextWithinDownshift = targetWithinDownshift(event.target)

      if (!contextWithinDownshift && getState().isOpen) {
        reset({
          type: useDownshift.stateChangeTypes.mouseUp,
        })

        params.onOuterClick(getStateAndHelpers())
      }
    }

    const onTouchStart = () => {
      isTouchMoveRef.current = false
    }

    const onTouchMove = () => {
      isTouchMoveRef.current = true
    }

    const onTouchEnd = event => {
      const contextWithinDownshift = targetWithinDownshift(event.target, false)

      if (
        !isTouchMoveRef.current &&
        !contextWithinDownshift &&
        getState().isOpen
      ) {
        reset({
          type: useDownshift.stateChangeTypes.touchEnd,
        })

        params.onOuterClick(getStateAndHelpers())
      }
    }

    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      internalClearTimeouts()

      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [state])

  useEffect(() => {
    if (
      isControlledParam('selectedItem') &&
      params.selectedItemChanged(
        previousParams ? previousParams.selectedItem : null,
        params.selectedItem,
      )
    ) {
      internalSetState({
        type: useDownshift.stateChangeTypes.controlledPropUpdatedSelectedItem,
        inputValue: params.itemToString(params.selectedItem),
      })
    }

    if (
      !avoidScrollingRef.current &&
      shouldScroll(previousState, previousParams)
    ) {
      scrollHighlightedItemIntoView()
    }

    updateStatus()
  }, [state, params])

  const updateStatus = debounce(() => {
    const state = getState()
    const item = itemsRef.current[state.highlightedIndex]
    const resultCount = getItemCount()
    const status = params.getA11yStatusMessage({
      itemToString: params.itemToString,
      previousResultCount: previousResultCountRef.current,
      resultCount,
      highlightedItem: item,
      ...state,
    })
    previousResultCountRef.current = resultCount

    setA11yStatus(status)
  }, 200)

  const scrollHighlightedItemIntoView = () => {
    const node = getItemNodeFromIndex(getState().highlightedIndex)
    params.scrollIntoView(node, menuRef.current)
  }

  const shouldScroll = (prevState, prevParams) => {
    const { highlightedIndex: currentHighlightedIndex } =
      params.highlightedIndex === undefined ? getState() : params
    const { highlightedIndex: prevHighlightedIndex } =
      prevParams.highlightedIndex === undefined ? prevState : prevParams
    const scrollWhenOpen =
      currentHighlightedIndex && getState().isOpen && !prevState.isOpen
    const scrollWhenNavigating =
      currentHighlightedIndex !== prevHighlightedIndex

    return scrollWhenOpen || scrollWhenNavigating
  }

  const internalSetTimeout = (fn, time) => {
    const id = setTimeout(() => {
      timeoutsIdsRef.current = timeoutsIdsRef.current.filter(i => i !== id)
      fn()
    }, time)

    timeoutsIdsRef.current.push(id)
  }

  const internalClearTimeouts = () => {
    timeoutsIdsRef.current.forEach(id => {
      clearTimeout(id)
    })

    timeoutsIdsRef.current.length = 0
  }

  const isControlledParam = key => {
    return params[key] !== undefined
  }

  const getState = (stateToMerge = state) => {
    return Object.keys(stateToMerge).reduce((s, key) => {
      s[key] = isControlledParam(key) ? params[key] : stateToMerge[key]
      return s
    }, {})
  }

  const internalSetState = (stateToSet, cb) => {
    let isItemSelected, onChangeArg

    const onStateChangeArg = {}
    const isStateToSetFunction = typeof stateToSet === 'function'

    if (!isStateToSetFunction && stateToSet.hasOwnProperty('inputValue')) {
      params.onInputValueChange(stateToSet.inputValue, {
        ...getStateAndHelpers(),
        ...stateToSet,
      })
    }

    const s = getState(state)

    let newStateToSet = isStateToSetFunction ? stateToSet(s) : stateToSet

    newStateToSet = params.stateReducer(s, newStateToSet)

    isItemSelected = newStateToSet.hasOwnProperty('selectedItem')

    const nextState = {}
    const nextFullState = {}

    if (isItemSelected && newStateToSet.selectedItem !== s.selectedItem) {
      onChangeArg = newStateToSet.selectedItem
    }

    newStateToSet.type =
      newStateToSet.type || useDownshift.stateChangeTypes.unknown

    Object.keys(newStateToSet).forEach(key => {
      if (s[key] !== newStateToSet[key]) {
        onStateChangeArg[key] = newStateToSet[key]
      }

      if (key === 'type') {
        return
      }

      nextFullState[key] = newStateToSet[key]

      if (!isControlledParam(key)) {
        nextState[key] = newStateToSet[key]
      }
    })

    if (isStateToSetFunction && newStateToSet.hasOwnProperty('inputValue')) {
      params.onInputValueChange(newStateToSet.inputValue, {
        ...getStateAndHelpers(),
        ...newStateToSet,
      })
    }

    setState({ ...state, ...nextState })

    internalSetTimeout(() => {
      cbToCb(cb)()

      const hasMoreStateThanType = Object.keys(onStateChangeArg).length > 1

      if (hasMoreStateThanType) {
        params.onStateChange(onStateChangeArg, getStateAndHelpers())
      }

      if (isItemSelected) {
        params.onSelect(stateToSet.selectedItem, getStateAndHelpers())
      }

      if (onChangeArg !== undefined) {
        params.onChange(onChangeArg, getStateAndHelpers())
      }

      params.onUserAction(onStateChangeArg, getStateAndHelpers())
    })
  }

  const clearItems = () => {
    itemsRef.current.length = 0
  }

  const reset = (otherStateToSet = {}, cb) => {
    otherStateToSet = pickState(otherStateToSet)

    internalSetState(
      ({ selectedItem }) => ({
        isOpen: params.defaultIsOpen,
        highlightedIndex: params.defaultHighlightedIndex,
        inputValue: params.itemToString(selectedItem),
        ...otherStateToSet,
      }),
      cb,
    )
  }

  const getItemNodeFromIndex = index => {
    return window.document.getElementById(params.getItemId(index))
  }

  const getItemCount = () => {
    let itemCount = itemsRef.current.length

    if (itemCountRef.current != null) {
      itemCount = itemCountRef.current
    } else if (params.itemCount !== undefined) {
      itemCount = params.itemCount
    }

    return itemCount
  }

  const selectItem = (item, otherStateToSet, cb) => {
    otherStateToSet = pickState(otherStateToSet)

    internalSetState(
      {
        isOpen: params.defaultIsOpen,
        highlightedIndex: params.defaultHighlightedIndex,
        selectedItem: item,
        inputValue: params.itemToString(item),
        ...otherStateToSet,
      },
      cb,
    )
  }

  const selectItemAtIndex = (itemIndex, otherStateToSet, cb) => {
    const item = itemsRef.current[itemIndex]

    if (item == null) {
      return
    }

    selectItem(item, otherStateToSet, cb)
  }

  const selectHighlightedItem = (otherStateToSet, cb) => {
    return selectItemAtIndex(getState().highlightedIndex, otherStateToSet, cb)
  }

  const moveHighlightedIndex = (amount, otherStateToSet) => {
    const itemCount = getItemCount()

    if (itemCount > 0) {
      const nextHighlightedIndex = getNextWrappingIndex(
        amount,
        getState().highlightedIndex,
        itemCount,
      )

      setHighlightedIndex(nextHighlightedIndex, otherStateToSet)
    }
  }

  const highlightFirstOrLastIndex = (event, first, otherStateToSet) => {
    const itemsLastIndex = getItemCount() - 1

    if (itemsLastIndex < 0 || !getState().isOpen) {
      return
    }

    event.preventDefault()

    setHighlightedIndex(first ? 0 : itemsLastIndex, otherStateToSet)
  }

  const keyDownHandlers = {
    ArrowDown: event => {
      event.preventDefault()

      if (getState().isOpen) {
        const amount = event.shiftKey ? 5 : 1

        moveHighlightedIndex(amount, {
          type: useDownshift.stateChangeTypes.keyDownArrowDown,
        })
      } else {
        internalSetState(
          {
            isOpen: true,
            type: useDownshift.stateChangeTypes.keyDownArrowDown,
          },
          () => {
            const itemCount = getItemCount()

            if (itemCount > 0) {
              setHighlightedIndex(
                getNextWrappingIndex(1, getState().highlightedIndex, itemCount),
                {
                  isOpen: true,
                  type: useDownshift.stateChangeTypes.keyDownArrowDown,
                },
              )
            }
          },
        )
      }
    },

    ArrowUp: event => {
      event.preventDefault()

      if (getState().isOpen) {
        const amount = event.shiftKey ? -5 : -1

        moveHighlightedIndex(amount, {
          type: useDownshift.stateChangeTypes.keyDownArrowUp,
        })
      } else {
        internalSetState(
          {
            isOpen: true,
            type: useDownshift.stateChangeTypes.keyDownArrowUp,
          },
          () => {
            const itemCount = getItemCount()

            if (itemCount > 0) {
              setHighlightedIndex(
                getNextWrappingIndex(
                  -1,
                  getState().highlightedIndex,
                  itemCount,
                ),
                {
                  isOpen: true,
                  type: useDownshift.stateChangeTypes.keyDownArrowDown,
                },
              )
            }
          },
        )
      }
    },

    Enter: event => {
      const { isOpen, highlightedIndex } = getState()

      if (isOpen && highlightedIndex != null) {
        event.preventDefault()

        const item = itemsRef.current[highlightedIndex]
        const itemNode = getItemNodeFromIndex(highlightedIndex)

        if (item == null || (itemNode && itemNode.hasAttribute('disabled'))) {
          return
        }

        selectHighlightedItem({
          type: useDownshift.stateChangeTypes.keyDownEnter,
        })
      }
    },

    Escape: event => {
      event.preventDefault()

      reset({
        type: useDownshift.stateChangeTypes.keyDownEscape,
        selectedItem: null,
        inputValue: '',
      })
    },
  }

  const inputKeyDownHandlers = {
    ...keyDownHandlers,
    Home: event => {
      highlightFirstOrLastIndex(event, true, {
        type: useDownshift.stateChangeTypes.keyDownHome,
      })
    },

    End: event => {
      highlightFirstOrLastIndex(event, false, {
        type: useDownshift.stateChangeTypes.keyDownEnd,
      })
    },
  }

  const buttonKeyDownHandlers = {
    ...keyDownHandlers,

    ' ': event => {
      event.preventDefault()

      toggleMenu({
        type: useDownshift.stateChangeTypes.keyDownSpaceButton,
      })
    },
  }

  const inputHandleChange = event => {
    internalSetState({
      type: useDownshift.stateChangeTypes.changeInput,
      isOpen: true,
      inputValue: event.target.value,
      highlightedIndex: params.defaultHighlightedIndex,
    })
  }

  const inputHandleKeyDown = event => {
    const key = normalizeArrowKey(event)

    if (key && inputKeyDownHandlers[key]) {
      inputKeyDownHandlers[key](event)
    }
  }

  const setHighlightedIndex = (
    highlightedIndex = params.defaultHighlightedIndex,
    otherStateToSet = {},
  ) => {
    otherStateToSet = pickState(otherStateToSet)

    internalSetState({
      highlightedIndex,
      ...otherStateToSet,
    })
  }

  const inputHandleBlur = () => {
    internalSetTimeout(() => {
      const downshiftButtonIsActive =
        window.document &&
        !!window.document.activeElement &&
        !!window.document.activeElement.dataset &&
        window.document.activeElement.dataset.toggle &&
        (rootRef.current &&
          rootRef.current.contains(window.document.activeElement))

      if (!isMouseDownRef.current && !downshiftButtonIsActive) {
        reset({
          type: useDownshift.stateChangeTypes.blurInput,
        })
      }
    })
  }

  const buttonHandleClick = event => {
    event.preventDefault()

    if (window.document.activeElement === window.document.body) {
      event.target.focus()
    }

    internalSetTimeout(() =>
      toggleMenu({
        type: useDownshift.stateChangeTypes.clickButton,
      }),
    )
  }

  const buttonHandleKeyDown = event => {
    const key = normalizeArrowKey(event)

    if (buttonKeyDownHandlers[key]) {
      buttonKeyDownHandlers[key](event)
    }
  }

  const buttonHandleKeyUp = event => {
    event.preventDefault()
  }

  const buttonHandleBlur = event => {
    const blurTarget = event.target

    internalSetTimeout(() => {
      if (
        !isMouseDownRef.current &&
        (window.document.activeElement == null ||
          window.document.activeElement.id !== params.inputId) &&
        window.document.activeElement !== blurTarget
      ) {
        reset({
          type: useDownshift.stateChangeTypes.blurButton,
        })
      }
    })
  }

  const getRootProps = ({ refKey = 'ref', ...rest } = {}) => {
    const { isOpen } = state
    const { menuId, labelId } = params

    return {
      [refKey]: rootRef,
      role: 'combobox',
      'aria-expanded': isOpen,
      'aria-haspopup': 'listbox',
      'aria-owns': isOpen ? menuId : null,
      'aria-labelledby': labelId,
      ...rest,
    }
  }

  const getMenuProps = ({ refKey = 'ref', ref, ...props } = {}) => {
    const { menuId, labelId } = params

    return {
      [refKey]: callAll(ref, r => (menuRef.current = r)),
      role: 'listbox',
      'aria-labelledby': props && props['aria-label'] ? null : labelId,
      id: menuId,
      ...props,
    }
  }

  const getItemProps = ({
    onMouseMove,
    onMouseDown,
    onClick,
    index,
    item,
    ...rest
  }) => {
    if (index === undefined) {
      itemsRef.current.push(item)
      index = itemsRef.current.indexOf(item)
    } else {
      itemsRef.current[index] = item
    }

    const enabledEventHandlers = {
      onMouseMove: callAllEventHandlers(onMouseMove, () => {
        if (index === getState().highlightedIndex) {
          return
        }

        setHighlightedIndex(index, {
          type: useDownshift.stateChangeTypes.itemMouseEnter,
        })

        avoidScrollingRef.current = true

        internalSetTimeout(() => (avoidScrollingRef.current = false), 250)
      }),
      onMouseDown: callAllEventHandlers(onMouseDown, event => {
        event.preventDefault()
      }),
      onClick: callAllEventHandlers(onClick, () => {
        selectItemAtIndex(index, {
          type: useDownshift.stateChangeTypes.clickItem,
        })
      }),
    }

    const eventHandlers = rest.disabled
      ? { onMouseDown: enabledEventHandlers.onMouseDown }
      : enabledEventHandlers

    return {
      id: params.getItemId(index),
      role: 'option',
      'aria-selected': getState().highlightedIndex === index,
      ...eventHandlers,
      ...rest,
    }
  }

  const getLabelProps = props => {
    const { labelId, inputId } = params

    return {
      id: labelId,
      htmlFor: inputId,
      ...props,
    }
  }

  const getInputProps = ({
    onKeyDown,
    onBlur,
    onChange,
    onInput,
    onChangeText,
    ...rest
  } = {}) => {
    let eventHandlers = {}

    const { isOpen, inputValue, highlightedIndex } = state
    const { menuId, labelId, inputId, getItemId } = params

    if (!rest.disabled) {
      eventHandlers = {
        onChange: callAllEventHandlers(onChange, onInput, inputHandleChange),
        onKeyDown: callAllEventHandlers(onKeyDown, inputHandleKeyDown),
        onBlur: callAllEventHandlers(onBlur, inputHandleBlur),
      }
    }

    return {
      'aria-autocomplete': 'list',
      'aria-activedescendant':
        isOpen && typeof highlightedIndex === 'number' && highlightedIndex >= 0
          ? getItemId(highlightedIndex)
          : null,
      'aria-controls': isOpen ? menuId : null,
      'aria-labelledby': labelId,
      autoComplete: 'off',
      value: inputValue,
      id: inputId,
      ...eventHandlers,
      ...rest,
    }
  }

  const getToggleButtonProps = ({
    onClick,
    onPress,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...rest
  } = {}) => {
    const { isOpen } = getState()

    const enabledEventHandlers = {
      onClick: callAllEventHandlers(onClick, buttonHandleClick),
      onKeyDown: callAllEventHandlers(onKeyDown, buttonHandleKeyDown),
      onKeyUp: callAllEventHandlers(onKeyUp, buttonHandleKeyUp),
      onBlur: callAllEventHandlers(onBlur, buttonHandleBlur),
    }

    const eventHandlers = rest.disabled ? {} : enabledEventHandlers

    return {
      type: 'button',
      role: 'button',
      'aria-label': isOpen ? 'close menu' : 'open menu',
      'aria-haspopup': true,
      'data-toggle': true,
      ...eventHandlers,
      ...rest,
    }
  }

  const toggleMenu = (otherStateToSet = {}, cb) => {
    otherStateToSet = pickState(otherStateToSet)

    let newState = {}

    internalSetState(
      ({ isOpen }) => {
        newState = {
          isOpen: !isOpen,
          ...(isOpen && {
            highlightedIndex: params.defaultHighlightedIndex,
          }),
          ...otherStateToSet,
        }

        return newState
      },
      () => {
        const { isOpen, highlightedIndex } = newState

        if (isOpen) {
          if (getItemCount() > 0 && typeof highlightedIndex === 'number') {
            setHighlightedIndex(highlightedIndex, otherStateToSet)
          }
        }

        cbToCb(cb)()
      },
    )
  }

  const openMenu = cb => {
    internalSetState(
      {
        isOpen: true,
      },
      cb,
    )
  }

  const closeMenu = cb => {
    internalSetState(
      {
        isOpen: false,
      },
      cb,
    )
  }

  const clearSelection = cb => {
    internalSetState(
      {
        selectedItem: null,
        inputValue: '',
        highlightedIndex: params.defaultHighlightedIndex,
        isOpen: params.defaultIsOpen,
      },
      cb,
    )
  }

  const setItemCount = count => {
    itemCountRef.current = count
  }

  const unsetItemCount = () => {
    itemCountRef.current = null
  }

  const getStateAndHelpers = () => {
    const { isOpen, inputValue, selectedItem, highlightedIndex } = getState()
    const { id, itemToString } = params

    return {
      // prop getters
      getRootProps,
      getMenuProps,
      getItemProps,
      getLabelProps,
      getInputProps,
      getToggleButtonProps,

      // actions
      reset,
      openMenu,
      closeMenu,
      toggleMenu,
      selectItem,
      selectItemAtIndex,
      selectHighlightedItem,
      setHighlightedIndex,
      clearSelection,
      clearItems,
      setItemCount,
      unsetItemCount,
      setState,

      // props
      itemToString,

      // derived
      id,

      // state
      highlightedIndex,
      inputValue,
      isOpen,
      selectedItem,
    }
  }

  clearItems()

  return getStateAndHelpers()
}

useDownshift.stateChangeTypes = {
  unknown: '__use-downshift_unknown__',
  mouseUp: '__use-downshift_mouseup__',
  itemMouseEnter: '__use-downshift_item_mouseenter__',
  keyDownArrowUp: '__use-downshift_keydown_arrow_up__',

  keyDownArrowDown: '__use-downshift_keydown_arrow_down__',

  keyDownEscape: '__use-downshift_keydown_escape__',
  keyDownEnter: '__use-downshift_keydown_enter__',
  keyDownHome: '__use-downshift_keydown_home__',
  keyDownEnd: '__use-downshift_keydown_end__',
  clickItem: '__use-downshift_click_item__',
  blurInput: '__use-downshift_blur_input__',
  changeInput: '__use-downshift_change_input__',
  keyDownSpaceButton: '__use-downshift_keydown_space_button__',

  clickButton: '__use-downshift_click_button__',
  blurButton: '__use-downshift_blur_button__',
  controlledPropUpdatedSelectedItem:
    '__use-downshift_controlled_prop_updated_selected_item__',

  touchEnd: '__use-downshift_touchend__',
}

export default useDownshift

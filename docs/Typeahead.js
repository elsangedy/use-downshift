import React, { useState } from 'react'

import useDownshift from '../src'

import Item from './shared/Item'

function Typeahead({ items }) {
  const [value, setValue] = useState()

  const onStateChange = changes => {
    if (changes.hasOwnProperty('selectedItem')) {
      setValue(changes.selectedItem)
    } else if (changes.hasOwnProperty('inputValue')) {
      setValue(changes.inputValue)
    }
  }

  const {
    isOpen,
    getRootProps,
    getMenuProps,
    getItemProps,
    getLabelProps,
    getInputProps,
    highlightedIndex,
    inputValue,
    selectedItem,
  } = useDownshift({
    onStateChange,
    selectedItem: value,
  })

  return (
    <div>
      <strong>{value || '[start typing...]'}</strong>
      <div {...getRootProps()}>
        <label {...getLabelProps()}>Typeahead</label>
        <br />
        <input {...getInputProps({ placeholder: 'search...' })} />

        {isOpen && (
          <div {...getMenuProps()}>
            <ul>
              {items
                .filter(
                  item =>
                    !inputValue ||
                    inputValue === selectedItem ||
                    item.toLowerCase().includes(inputValue.toLowerCase()),
                )
                .map((item, index) => (
                  <Item
                    {...getItemProps({
                      key: index,
                      item,
                      active: highlightedIndex === index,
                      selected: selectedItem === item,
                    })}
                  >
                    {item}
                  </Item>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default Typeahead

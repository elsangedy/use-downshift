import React from 'react'

import useDownshift from '../src'

import Item from './shared/Item'

function Autocomplete({ items, label, onChange }) {
  const itemToString = item => (item ? item.name : '')

  const {
    isOpen,
    getRootProps,
    getMenuProps,
    getItemProps,
    getLabelProps,
    getInputProps,
    getToggleButtonProps,
    highlightedIndex,
    inputValue,
    selectedItem,
    clearSelection,
  } = useDownshift({
    itemToString,
    onChange,
  })

  return (
    <div {...getRootProps()}>
      <label {...getLabelProps()}>{label}</label>
      <br />
      <input {...getInputProps({ placeholder: 'search...' })} />
      {inputValue && <button onClick={() => clearSelection()}>x</button>}
      <button {...getToggleButtonProps()}>toggle</button>

      {isOpen && (
        <div {...getMenuProps()}>
          <ul>
            {items
              .filter(
                item =>
                  !inputValue ||
                  inputValue === itemToString(selectedItem) ||
                  item.name.toLowerCase().includes(inputValue.toLowerCase()),
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
                  {item.name}
                </Item>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default Autocomplete

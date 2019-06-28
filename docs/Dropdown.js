import React from 'react'

import useDownshift from '../src'

import Item from './shared/Item'

function Dropdown({ items, label, onChange }) {
  const {
    isOpen,
    getRootProps,
    getMenuProps,
    getItemProps,
    getToggleButtonProps,
    highlightedIndex,
    selectedItem,
  } = useDownshift({
    onChange,
  })

  return (
    <div {...getRootProps()}>
      <button {...getToggleButtonProps()}>{selectedItem || label}</button>

      {isOpen && (
        <div {...getMenuProps()}>
          <ul>
            {items.map((item, index) => (
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
  )
}

export default Dropdown

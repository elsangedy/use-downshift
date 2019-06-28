# use-downshift

![MIT License][license-badge]
[![downloads][downloads-badge]][npmcharts]
[![PRs Welcome][prs-badge]][prs]

## Installation

```bash
$ yarn add use-downshift
# or
$ npm i use-downshift
```

## Usage

```jsx
import React from 'react'

import useDownshift from 'use-downshift'

const items = [
  {value: 'apple'},
  {value: 'pear'},
  {value: 'orange'},
  {value: 'grape'},
  {value: 'banana'},
]

function MyComponent() {
  const {
    isOpen,
    getRootProps,
    getMenuProps,
    getItemProps,
    getLabelProps,
    getInputProps,
    highlightedIndex,
    inputValue,
    selectedItem
  } = useDownshift({
    onChange={selection => alert(`You selected ${selection.value}`)}
    itemToString={item => (item ? item.value : '')}
  })

  return (
    <div {...getRootProps()}>
      <label {...getLabelProps()}>{label}</label>
      <input {...getInputProps({ placeholder: 'search...' })} />
      {isOpen && (
        <ul {...getMenuProps()}>
          {items
            .filter(item => !inputValue || item.value.includes(inputValue))
            .map((item, index) => (
              <li
                {...getItemProps({
                  key: index,
                  item,
                  style: {
                    background: highlightedIndex === index ? 'lightgray' : 'white',
                    fontWeight: selectedItem === item ? 'bold' : 'normal',
                  }
                })}
              >
                {item.value}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

export default MyComponent
```

## Inspiration

[downshift](https://github.com/downshift-js/downshift)

## LIENSE

MIT

[license-badge]: https://img.shields.io/npm/l/use-downshift.svg?style=flat-square
[downloads-badge]: https://img.shields.io/npm/dm/use-downshift.svg?style=flat-square
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[npmcharts]: http://npmcharts.com/compare/use-downshift

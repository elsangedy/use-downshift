import React, { memo } from 'react'

const Item = memo(({ active, selected, children, ...props }) => {
  return (
    <li
      style={{
        background: active ? '#ddd' : '',
        fontWeight: selected ? 'bold' : 'normal',
      }}
      {...props}
    >
      {children}
    </li>
  )
})

export default Item

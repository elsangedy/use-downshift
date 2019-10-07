import { useRef, useEffect } from 'react'

function usePrevious(value) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  })

  return ref.current
}

export default usePrevious

import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const container = document.getElementById('root')

if (container === null) {
  throw new Error('Expected #root to exist')
}

createRoot(container).render(<App />)

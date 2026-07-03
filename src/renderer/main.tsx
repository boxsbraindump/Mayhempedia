import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
console.log('[Mayhempedia] React 已挂载 · window.mayhem 可用:', typeof window.mayhem !== 'undefined')

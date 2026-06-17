import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './Router'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

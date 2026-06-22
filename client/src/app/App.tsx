import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit'
import { AppRouter } from './Router'

const queryClient = new QueryClient()

// Route Sui RPC calls through our backend to avoid CORS blocks from the Sui fullnode.
// In dev, the Vite proxy (localhost:3001) handles it; in prod, VITE_API_URL points to
// the deployed server which already has CORS configured for lev-pilot.vercel.app.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const { networkConfig } = createNetworkConfig({
  testnet: { url: `${API_BASE}/rpc`, network: 'testnet' as const },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}

import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit'
import { AppRouter } from './Router'

const queryClient = new QueryClient()
const { networkConfig } = createNetworkConfig({
  testnet: { url: 'https://fullnode.testnet.sui.io:443', network: 'testnet' as const },
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

# Holaplex Marketplace Standard JS SDK

Submit actions to the [Metaplex Auction House](https://docs.metaplex.com/auction-house/definition) program that adhere to the Holaplex Marketplace Standard. Its recommend to leverage the sdk with typescript to get access to the package type definitions.

## Getting Started

Install the package from npm using your favorite package manager.

```shell
npm install -S @holaplex/marketplace-js-sdk
yarn add @holaplex/marketplace-js-sdk
```

## Usage

Examples of using the sdk from different javascript based development environments.

### React

```javascript
import { initMarketplaceSDK } from '@holaplex/marketplace-js-sdk'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const Page = () => {
  const wallet = useWallet()
  const connection = useConnection()

  const sdk = useMemo(() => initMarketplaceSDK(connection, wallet), [connection, wallet])

  return (
    ...
  )
}
```

## Contributing

As with all [Holaplex](https://www.holaplex.com/) repositories contributions are welcome. Please fork and publish a pull request with any fixes or enhancements.



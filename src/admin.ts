import { createWithdrawFromTreasuryInstruction } from '@metaplex-foundation/mpl-auction-house/dist/src/generated/instructions'
import { Wallet } from '@metaplex/js'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { MarketplaceClient } from './marketplace'
import { AuctionHouse, MarktplaceSettingsPayload } from './types'

interface MarketplaceBaseParams {
  logo: { uri: string; type?: string; name?: string }
  banner: { uri: string; type?: string; name?: string }
  subdomain: string
  name: string
  description: string
  transactionFee: number
  creators: { address: string }[]
}

export type EditMarketplaceParams = MarketplaceBaseParams & {
  auctionHouses: { address: string }[]
}

export type EditTokensParams = MarketplaceBaseParams & {
  originalAuctionHouses: AuctionHouse[]
  tokens: { address: string }[]
}

export class AdminClient extends MarketplaceClient {
  constructor(connection: Connection, wallet: Wallet) {
    super(connection, wallet)
  }

  async editMarketplace({
    logo,
    banner,
    subdomain,
    name,
    description,
    transactionFee,
    creators,
    auctionHouses,
  }: EditMarketplaceParams) {
    const settings: MarktplaceSettingsPayload = {
      meta: {
        name,
        description,
      },
      theme: {
        logo: {
          name: logo.name,
          type: logo.type,
          url: logo.uri,
        },
        banner: {
          name: banner.name,
          type: banner.type,
          url: banner.uri,
        },
      },
      creators,
      subdomain: subdomain,
      address: { owner: this.wallet.publicKey.toBase58() as string },
      auctionHouses: auctionHouses,
    }

    await super.update(settings, transactionFee)
  }

  async editTokens({
    logo,
    banner,
    subdomain,
    name,
    description,
    transactionFee,
    creators,
    originalAuctionHouses,
    tokens,
  }: EditTokensParams) {
    const originalTokens = originalAuctionHouses.map(({ treasuryMint }) => ({
      address: treasuryMint,
    }))

    // Remove auction houses corresponding to deleted tokens
    const allAuctionHouses = originalAuctionHouses
      .filter((ah) => tokens.some((token) => token.address === ah.treasuryMint))
      .map(({ address }) => ({
        address,
      }))

    // Add auction houses corresponding to new tokens
    const newTokens = tokens.filter(
      (token) => !originalTokens.some((ot) => ot.address === token.address)
    )
    if (newTokens.length > 0) {
      const newAuctionHouses = await this.createAuctionHouses(
        newTokens,
        transactionFee
      )
      allAuctionHouses.push(...newAuctionHouses)
    }

    const settings: MarktplaceSettingsPayload = {
      meta: {
        name,
        description,
      },
      theme: {
        logo: {
          name: logo.name,
          type: logo.type,
          url: logo.uri,
        },
        banner: {
          name: banner.name,
          type: banner.type,
          url: banner.uri,
        },
      },
      creators,
      subdomain: subdomain,
      address: { owner: this.wallet.publicKey.toBase58() as string },
      auctionHouses: allAuctionHouses,
    }

    await super.update(settings, transactionFee)
  }

  async claimFunds(ah: AuctionHouse) {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection
    const auctionHouse = new PublicKey(ah.address)
    const authority = new PublicKey(ah.authority)
    const treasuryMint = new PublicKey(ah.treasuryMint)
    const auctionHouseTreasury = new PublicKey(ah.auctionHouseTreasury)

    const treasuryWithdrawalDestination = new PublicKey(
      ah.treasuryWithdrawalDestination
    )

    const auctionHouseTreasuryBalance = await connection.getBalance(
      auctionHouseTreasury
    )

    const withdrawFromTreasuryInstructionAccounts = {
      treasuryMint,
      authority,
      treasuryWithdrawalDestination,
      auctionHouseTreasury,
      auctionHouse,
    }
    const withdrawFromTreasuryInstructionArgs = {
      amount: auctionHouseTreasuryBalance,
    }

    const withdrawFromTreasuryInstruction =
      createWithdrawFromTreasuryInstruction(
        withdrawFromTreasuryInstructionAccounts,
        withdrawFromTreasuryInstructionArgs
      )

    const txt = new Transaction()

    txt.add(withdrawFromTreasuryInstruction)

    txt.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    txt.feePayer = publicKey

    let signed: Transaction | undefined = undefined

    signed = await wallet.signTransaction(txt)

    let signature: string | undefined = undefined

    signature = await connection.sendRawTransaction(signed.serialize())

    await connection.confirmTransaction(signature, 'confirmed')
  }
}
